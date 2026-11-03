import { create } from 'zustand';

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  anim: string;
  bubble: string;
}

export interface NpcInfo {
  id: string;
  name: string;
  role: string;
  shop: string;
  position: [number, number, number];
  greeting: string;
  quests: { id: string; title: string; level: string }[];
}

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface GameState {
  playerName: string;
  setPlayerName: (n: string) => void;
  conn: ConnStatus;
  setConn: (c: ConnStatus) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  players: Record<string, RemotePlayer>;
  upsertPlayer: (p: RemotePlayer) => void;
  removePlayer: (id: string) => void;
  chatLog: { name: string; text: string; at: number }[];
  pushChat: (m: { name: string; text: string }) => void;

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
  pushChat: (m) =>
    set((s) => ({ chatLog: [...s.chatLog.slice(-49), { ...m, at: Date.now() }] })),

  npcs: [],
  setNpcs: (npcs) => set({ npcs }),
  interactTarget: null,
  setInteractTarget: (interactTarget) => set({ interactTarget }),
  panelNpc: null,
  openPanel: (panelNpc) => set({ panelNpc }),
  closePanel: () => set({ panelNpc: null }),
}));
