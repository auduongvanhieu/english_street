import { create } from 'zustand';
import { PROXIMITY_RADIUS } from '@es/shared';
import { useGame } from '../store/game';
import { getRoom, onRtc, sendRtc } from './client';

/**
 * Proximity voice chat as a small WebRTC mesh: every nearby player with voice
 * enabled gets a direct connection; signalling is relayed by the Colyseus room.
 * Volume fades with distance; peers beyond the radius are disconnected.
 */
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const CONNECT_RADIUS = PROXIMITY_RADIUS + 1;
const DROP_RADIUS = PROXIMITY_RADIUS + 3;
const FULL_VOLUME_RADIUS = 2.5;

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pending: RTCIceCandidateInit[];
  initiator: boolean;
}

const peers = new Map<string, Peer>();
let localStream: MediaStream | null = null;
let timer: number | null = null;
let unsubscribe: (() => void) | null = null;

interface VoiceChatStore {
  supported: boolean;
  enabled: boolean;
  muted: boolean;
  /** sessionIds with an open connection */
  connected: string[];
  error: string | null;
  enable: () => Promise<void>;
  disable: () => void;
  toggleMute: () => void;
}

export const useVoiceChat = create<VoiceChatStore>((set, get) => ({
  supported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined',
  enabled: false,
  muted: false,
  connected: [],
  error: null,

  async enable() {
    if (get().enabled) return;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (e) {
      set({ error: (e as Error).name === 'NotAllowedError' ? 'Microphone permission denied' : `Microphone error: ${(e as Error).message}` });
      return;
    }
    set({ enabled: true, error: null });
    unsubscribe = onRtc(handleSignal);
    timer = window.setInterval(tick, 500);
  },

  disable() {
    if (timer) window.clearInterval(timer);
    timer = null;
    unsubscribe?.();
    unsubscribe = null;
    for (const id of [...peers.keys()]) dropPeer(id);
    localStream?.getTracks().forEach((t) => t.stop());
    localStream = null;
    set({ enabled: false, connected: [], muted: false });
  },

  toggleMute() {
    const muted = !get().muted;
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    set({ muted });
  },
}));

function tick() {
  const g = useGame.getState();
  const me = g.sessionId ? g.players[g.sessionId] : null;
  if (!me) return;
  for (const p of Object.values(g.players)) {
    if (p.id === me.id) continue;
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    const peer = peers.get(p.id);
    if (!peer && p.voice && d <= CONNECT_RADIUS) {
      // Deterministic initiator avoids both sides offering at once.
      void connectPeer(p.id, me.id < p.id);
    } else if (peer && (d > DROP_RADIUS || !p.voice)) {
      dropPeer(p.id);
    } else if (peer) {
      peer.audio.volume = Math.max(0, Math.min(1, 1 - (d - FULL_VOLUME_RADIUS) / (PROXIMITY_RADIUS - FULL_VOLUME_RADIUS)));
    }
  }
  for (const id of peers.keys()) if (!g.players[id]) dropPeer(id);
}

function newPeer(id: string, initiator: boolean): Peer {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const audio = new Audio();
  audio.autoplay = true;
  const peer: Peer = { pc, audio, pending: [], initiator };
  peers.set(id, peer);
  localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream!));
  pc.onicecandidate = (e) => {
    if (e.candidate) sendRtc({ to: id, candidate: e.candidate.toJSON() });
  };
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    void audio.play().catch(() => undefined);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') syncConnected();
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') dropPeer(id);
  };
  return peer;
}

async function connectPeer(id: string, initiator: boolean) {
  if (peers.has(id)) return;
  const peer = newPeer(id, initiator);
  if (!initiator) return; // wait for their offer
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    sendRtc({ to: id, sdp: offer });
  } catch (e) {
    console.warn('[voice] offer failed', e);
    dropPeer(id);
  }
}

async function handleSignal(m: { from: string; sdp?: unknown; candidate?: unknown }) {
  if (!getRoom() || !useVoiceChat.getState().enabled) return;
  let peer = peers.get(m.from);
  try {
    if (m.sdp) {
      const sdp = m.sdp as RTCSessionDescriptionInit;
      if (sdp.type === 'offer') {
        if (!peer) peer = newPeer(m.from, false);
        await peer.pc.setRemoteDescription(sdp);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        sendRtc({ to: m.from, sdp: answer });
      } else if (sdp.type === 'answer' && peer) {
        await peer.pc.setRemoteDescription(sdp);
      }
      if (peer) {
        for (const c of peer.pending) await peer.pc.addIceCandidate(c);
        peer.pending = [];
      }
    } else if (m.candidate && peer) {
      const c = m.candidate as RTCIceCandidateInit;
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(c);
      else peer.pending.push(c);
    }
  } catch (e) {
    console.warn('[voice] signalling error', e);
  }
}

function dropPeer(id: string) {
  const p = peers.get(id);
  if (!p) return;
  peers.delete(id);
  p.pc.onconnectionstatechange = null;
  p.pc.close();
  p.audio.srcObject = null;
  syncConnected();
}

function syncConnected() {
  useVoiceChat.setState({ connected: [...peers.entries()].filter(([, p]) => p.pc.connectionState === 'connected').map(([id]) => id) });
}
