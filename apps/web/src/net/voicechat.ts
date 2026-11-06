import { create } from 'zustand';
import { track } from './analytics';
import { PROXIMITY_RADIUS, SHOUT_RADIUS } from '@es/shared';
import { useGame } from '../store/game';
import { getRoom, onRtc, sendRtc } from './client';

/**
 * Proximity voice chat as a small WebRTC mesh: every nearby player with voice enabled gets a direct
 * connection; signalling is relayed by the Colyseus room. Volume fades with distance; peers beyond the
 * radius are disconnected.
 *
 * Two extensions (phase 9):
 * - listen-only mode: the mesh can run without a microphone, so a player who never enabled voice still
 *   hears a private-talk partner or someone shouting nearby (started automatically by `watch`).
 * - shouting: while a player holds the shout button, everyone within SHOUT_RADIUS connects at full volume.
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
let watchTimer: number | null = null;
let unsubscribe: (() => void) | null = null;

interface VoiceChatStore {
  supported: boolean;
  /** Mesh running (with or without a microphone). */
  enabled: boolean;
  /** Microphone captured and sent. */
  mic: boolean;
  muted: boolean;
  /** Holding the shout button. */
  shouting: boolean;
  /** Private-talk partner: always connected, full volume. */
  talkPartner: string | null;
  /** sessionIds with an open connection */
  connected: string[];
  error: string | null;
  /** Turn the microphone on (asks for permission). */
  enable: () => Promise<void>;
  /** Join the mesh without a microphone (hear others only). */
  listen: () => void;
  disable: () => void;
  toggleMute: () => void;
  setShouting: (on: boolean) => Promise<void>;
  setTalkPartner: (id: string | null) => void;
}

export const useVoiceChat = create<VoiceChatStore>((set, get) => ({
  supported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined',
  enabled: false,
  mic: false,
  muted: false,
  shouting: false,
  talkPartner: null,
  connected: [],
  error: null,

  async enable() {
    if (get().mic) return;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (e) {
      set({ error: (e as Error).name === 'NotAllowedError' ? 'Microphone permission denied' : `Microphone error: ${(e as Error).message}` });
      return;
    }
    // Upgrading from listen-only: existing connections have no sending track, so rebuild them.
    if (get().enabled) for (const id of [...peers.keys()]) dropPeer(id);
    startMesh();
    set({ enabled: true, mic: true, error: null });
    track('voice_chat_on');
  },

  listen() {
    if (get().enabled || !get().supported) return;
    startMesh();
    set({ enabled: true, mic: false, error: null });
  },

  disable() {
    if (timer) window.clearInterval(timer);
    timer = null;
    unsubscribe?.();
    unsubscribe = null;
    for (const id of [...peers.keys()]) dropPeer(id);
    localStream?.getTracks().forEach((t) => t.stop());
    localStream = null;
    set({ enabled: false, mic: false, connected: [], muted: false, shouting: false });
  },

  toggleMute() {
    const muted = !get().muted;
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    set({ muted });
  },

  async setShouting(on) {
    if (on && !get().mic) await get().enable();
    if (on && !get().mic) return;
    if (on && !get().shouting) track('voice_shout');
    set({ shouting: on });
    if (on) tick();
  },

  setTalkPartner(id) {
    set({ talkPartner: id });
    if (id && !get().enabled) get().listen();
    if (get().enabled) tick();
  },
}));

function startMesh() {
  if (!unsubscribe) unsubscribe = onRtc(handleSignal);
  if (!timer) timer = window.setInterval(tick, 500);
}

/** Should I be connected to this player right now, and at what volume? */
function wanted(p: { id: string; voice: boolean; shouting: boolean; x: number; z: number }, me: { x: number; z: number }, selfShouting: boolean, partner: string | null): { connect: boolean; keep: boolean; volume: number } {
  const d = Math.hypot(p.x - me.x, p.z - me.z);
  if (p.id === partner) return { connect: true, keep: true, volume: 1 };
  if (p.voice && (p.shouting || selfShouting) && d <= SHOUT_RADIUS) return { connect: true, keep: true, volume: 1 };
  if (p.voice && d <= CONNECT_RADIUS) return { connect: true, keep: true, volume: fade(d) };
  return { connect: false, keep: p.voice && d <= DROP_RADIUS, volume: fade(d) };
}
const fade = (d: number) => Math.max(0, Math.min(1, 1 - (d - FULL_VOLUME_RADIUS) / (PROXIMITY_RADIUS - FULL_VOLUME_RADIUS)));

function tick() {
  const g = useGame.getState();
  const me = g.sessionId ? g.players[g.sessionId] : null;
  if (!me) return;
  const { shouting, talkPartner } = useVoiceChat.getState();
  for (const p of Object.values(g.players)) {
    if (p.id === me.id) continue;
    const w = wanted(p, me, shouting, talkPartner);
    const peer = peers.get(p.id);
    if (!peer && w.connect) {
      // Deterministic initiator avoids both sides offering at once.
      void connectPeer(p.id, me.id < p.id);
    } else if (peer && !w.keep) {
      dropPeer(p.id);
    } else if (peer) {
      peer.audio.volume = w.volume;
    }
  }
  for (const id of peers.keys()) if (!g.players[id]) dropPeer(id);
}

/** Starts listen-only mode when there is something to hear (talk partner, someone shouting nearby). */
export function initVoiceWatch() {
  if (watchTimer) return () => undefined;
  watchTimer = window.setInterval(() => {
    const vc = useVoiceChat.getState();
    if (vc.enabled || !vc.supported) return;
    const g = useGame.getState();
    const me = g.sessionId ? g.players[g.sessionId] : null;
    if (!me) return;
    const shouter = Object.values(g.players).some((p) => p.id !== me.id && p.voice && p.shouting && Math.hypot(p.x - me.x, p.z - me.z) <= SHOUT_RADIUS);
    if (shouter || vc.talkPartner) vc.listen();
  }, 1000);
  return () => {
    if (watchTimer) window.clearInterval(watchTimer);
    watchTimer = null;
  };
}

function newPeer(id: string, initiator: boolean): Peer {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const audio = new Audio();
  audio.autoplay = true;
  const peer: Peer = { pc, audio, pending: [], initiator };
  peers.set(id, peer);
  if (localStream) localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!));
  else if (initiator) pc.addTransceiver('audio', { direction: 'recvonly' });
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
  // an offer can get lost (e.g. it arrived while the other side was still switching its mic on): if the link
  // is not up after a while, start over (tick() reconnects)
  window.setTimeout(() => {
    if (peers.get(id) === peer && pc.connectionState !== 'connected') dropPeer(id);
  }, 6_000);
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
