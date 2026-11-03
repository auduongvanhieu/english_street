import { create } from 'zustand';

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  anim: string;
  voice: boolean;
  pid: string;
  /** JSON-encoded avatar config from the join options */
  avatar: string;
  bubble: string;
}

export interface NpcInfo {
  id: string;
  name: string;
  role: string;
  shop: string;
  position: [number, number, number];
  greeting: string;
  /** BCP-47 locale hint for TTS, e.g. en-GB */
  voice: string;
  quests: { id: string; title: string; level: string }[];
  pairQuests: { id: string; title: string; level: string; roles: { id: string; label: string }[] }[];
}

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type UiPanel = 'notebook' | 'daily' | 'avatar' | 'placement' | 'profile' | 'settings' | null;

interface GameState {
  playerName: string;
  setPlayerName: (n: string) => void;
  conn: ConnStatus;
  setConn: (c: ConnStatus) => void;
  /** Server-side reason of the last failed join (e.g. beta_pass_required). */
  connError: string | null;
  setConnError: (m: string | null) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  players: Record<string, RemotePlayer>;
  upsertPlayer: (p: RemotePlayer) => void;
  removePlayer: (id: string) => void;
  chatLog: { from: string; pid: string; name: string; text: string; at: number }[];
  pushChat: (m: { from: string; pid: string; name: string; text: string }) => void;
  /** Local one-shot emote (anim name) and when it ends. */
  emote: { name: string; until: number } | null;
  playEmote: (name: string) => void;
  /** Which profile panel is open. */
  uiPanel: UiPanel;
  setUiPanel: (p: UiPanel) => void;

  npcs: NpcInfo[];
  setNpcs: (n: NpcInfo[]) => void;
  /** NPC id the player is close enough to talk to */
  interactTarget: string | null;
  setInteractTarget: (id: string | null) => void;
  /** NPC currently open in the dialogue panel */
  panelNpc: string | null;
  openPanel: (id: string) => void;
  closePanel: () => void;
}

export const useGame = create<GameState>((set) => ({
  playerName: localStorage.getItem('es:name') ?? '',
  setPlayerName: (n) => {
    localStorage.setItem('es:name', n);
    set({ playerName: n });
  },
  conn: 'idle',
  setConn: (conn) => set({ conn }),
  connError: null,
  setConnError: (connError) => set({ connError }),
  sessionId: null,
  setSessionId: (sessionId) => set({ sessionId }),
  players: {},
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.id]: p } })),
  removePlayer: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.players;
      return { players: rest };
    }),
  chatLog: [],
  pushChat: (m) => set((s) => ({ chatLog: [...s.chatLog.slice(-49), { ...m, at: Date.now() }] })),
  emote: null,
  playEmote: (name) => set({ emote: { name, until: Date.now() + 2600 } }),
  uiPanel: null,
  setUiPanel: (uiPanel) => set({ uiPanel }),

  npcs: [],
  setNpcs: (npcs) => set({ npcs }),
  interactTarget: null,
  setInteractTarget: (interactTarget) => set({ interactTarget }),
  panelNpc: null,
  openPanel: (panelNpc) => set({ panelNpc }),
  closePanel: () => set({ panelNpc: null }),
}));
