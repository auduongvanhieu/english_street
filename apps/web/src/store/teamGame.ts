import { create } from 'zustand';
import type { TeamEvent, TeamGameId, TeamId, TeamSend, TeamState } from '@es/shared';
import { onTeam, sendTeam } from '../net/client';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { useGame } from './game';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Team games (ui/TeamGameHud.tsx): the zone's lobby and the game in play, from the game server; the draw word (for
 * the drawer) and the drawing; my result (reported once per game).
 */
export interface Stroke {
  pts: number[];
  color: string;
}
interface TeamGameStore {
  open: boolean;
  state: TeamState | null;
  feed: { team: TeamId; by: string; ok: boolean; text: string; at: number }[];
  word: string;
  strokes: Stroke[];
  result: MinigameResult | null;
  reported: number;
  setOpen: (o: boolean) => void;
  send: (m: TeamSend) => void;
  join: (team: TeamId) => void;
  pick: (game: TeamGameId) => void;
  start: () => void;
}

export const useTeamGame = create<TeamGameStore>((set) => ({
  open: false,
  state: null,
  feed: [],
  word: '',
  strokes: [],
  result: null,
  reported: 0,
  setOpen(open) {
    set({ open });
    if (open) sendTeam({ op: 'hello' });
  },
  send: (m) => sendTeam(m),
  join(team) {
    sendTeam({ op: 'join', team });
    track('teamgame_join', { team });
  },
  pick: (game) => sendTeam({ op: 'game', game }),
  start() {
    sendTeam({ op: 'start' });
    track('teamgame_start');
  },
}));

/** My team in a state (by my session id). */
export const myTeam = (s: TeamState | null): TeamId | null => {
  const me = useGame.getState().sessionId;
  if (!s || !me) return null;
  return s.teams.red.some((p) => p.id === me) ? 'red' : s.teams.blue.some((p) => p.id === me) ? 'blue' : null;
};

export function initTeamGame() {
  return onTeam((m: TeamEvent) => {
    const st = useTeamGame.getState();
    switch (m.op) {
      case 'feed':
        useTeamGame.setState({ feed: [...st.feed, { ...m, at: Date.now() + Math.random() }].slice(-6) });
        return;
      case 'word':
        useTeamGame.setState({ word: m.word });
        useVoice.getState().speakAs('me', `Draw ${m.word}!`, 'en-US');
        return;
      case 'stroke':
        useTeamGame.setState({ strokes: [...st.strokes, { pts: m.pts, color: m.color }] });
        return;
      case 'strokes':
        useTeamGame.setState({ strokes: m.list });
        return;
      case 'clear':
        useTeamGame.setState({ strokes: [] });
        return;
      case 'state': {
        const prev = st.state;
        const s = m.state;
        const fresh = s.phase === 'countdown' && prev?.phase !== 'countdown';
        // a new draw round: the old word is gone
        const newRound = s.draw && prev?.draw && s.draw.round !== prev.draw.round;
        useTeamGame.setState({ state: s, ...(fresh ? { feed: [], result: null, word: '', strokes: [] } : {}), ...(newRound ? { word: '' } : {}) });
        const mine = myTeam(s);
        if (mine && fresh) useTeamGame.setState({ open: true });
        if (s.draw?.word && prev?.draw && !prev.draw.word) useVoice.getState().speakAs('me', `It was ${s.draw.word}!`, 'en-US');
        // the end: report my result once
        if (mine && s.phase === 'done' && prev?.phase === 'playing' && st.reported !== s.startsAt) {
          useTeamGame.setState({ reported: s.startsAt });
          const score = s.winner === mine ? 5 : s.winner === 'draw' ? 3 : 2;
          track('teamgame_done', { game: s.game, win: s.winner === mine });
          void reportMinigame(s.game, { score })
            .then((result) => {
              useTeamGame.setState({ result });
              void useProfile.getState().refresh();
            })
            .catch(() => undefined);
        }
      }
    }
  });
}
