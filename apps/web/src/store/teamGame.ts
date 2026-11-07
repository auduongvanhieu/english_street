import { create } from 'zustand';
import type { RelayState, RelayTeam, TeamEvent } from '@es/shared';
import { onTeam, sendTeam } from '../net/client';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { useGame } from './game';
import { useProfile } from './profile';
import { useVoice } from './voice';

/** Team games (Word Relay): the zone's lobby and game state from the game server, my answers, the reward. */
interface TeamGameStore {
  open: boolean;
  state: RelayState | null;
  /** the last answer someone gave (for the feed) */
  feed: { team: RelayTeam; by: string; ok: boolean; word: string; at: number }[];
  result: MinigameResult | null;
  reported: number;
  setOpen: (o: boolean) => void;
  join: (team: RelayTeam) => void;
  leave: () => void;
  start: () => void;
  answer: (n: number, choice: number) => void;
}

export const useTeamGame = create<TeamGameStore>((set) => ({
  open: false,
  state: null,
  feed: [],
  result: null,
  reported: 0,
  setOpen(open) {
    set({ open });
    if (open) sendTeam({ op: 'hello' });
  },
  join(team) {
    sendTeam({ op: 'join', team });
    track('relay_join', { team });
  },
  leave: () => sendTeam({ op: 'leave' }),
  start() {
    sendTeam({ op: 'start' });
    track('relay_start');
  },
  answer: (n, choice) => sendTeam({ op: 'answer', n, choice }),
}));

/** My team in a state (by my session id). */
export const myTeam = (s: RelayState | null): RelayTeam | null => {
  const me = useGame.getState().sessionId;
  if (!s || !me) return null;
  return s.teams.red.some((p) => p.id === me) ? 'red' : s.teams.blue.some((p) => p.id === me) ? 'blue' : null;
};

export function initTeamGame() {
  return onTeam((m: TeamEvent) => {
    const st = useTeamGame.getState();
    if (m.op === 'answer') {
      useTeamGame.setState({ feed: [...st.feed, { ...m, at: Date.now() }].slice(-6) });
      if (myTeam(st.state) === m.team && m.ok) useVoice.getState().speakAs('me', m.word, 'en-US');
      return;
    }
    const prev = st.state;
    useTeamGame.setState({ state: m.state, ...(m.state.phase === 'countdown' && prev?.phase !== 'countdown' ? { feed: [], result: null } : {}) });
    const mine = myTeam(m.state);
    // a game starts: open the panel for the players in it
    if (mine && m.state.phase === 'countdown' && prev?.phase !== 'countdown') useTeamGame.setState({ open: true });
    // the end: report my result once (a win, a loss or a draw)
    if (mine && m.state.phase === 'done' && prev?.phase === 'playing' && st.reported !== m.state.startsAt) {
      useTeamGame.setState({ reported: m.state.startsAt });
      const score = m.state.winner === mine ? 5 : m.state.winner === 'draw' ? 3 : 2;
      track('relay_done', { win: m.state.winner === mine });
      void reportMinigame('relay', { score })
        .then((result) => {
          useTeamGame.setState({ result });
          void useProfile.getState().refresh();
        })
        .catch(() => undefined);
    }
  });
}
