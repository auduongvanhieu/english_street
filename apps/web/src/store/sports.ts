import { create } from 'zustand';
import { FOOTBALL, type SportEvent, type Team } from '@es/shared';
import { onMatch, onSport, sendSport } from '../net/client';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { localPos } from '../scene/LocalPlayer';
import { t } from '../i18n';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Sports park football (client side): my team, the live score (from the server state), the coach's commentary on
 * goals and full time, and the reward for a finished match (reported to the API, capped per day there).
 */
interface SportsStore {
  team: Team | '';
  red: number;
  blue: number;
  endsAt: number;
  /** last big moment, shown as a banner for a few seconds */
  banner: string | null;
  reward: (MinigameResult & { game: string }) | null;
  setTeam: (team: Team | '') => void;
  showBanner: (text: string | null) => void;
}

const P = FOOTBALL.pitch;
/** Am I on (or right next to) the pitch? */
export const onPitch = (x = localPos.x, z = localPos.z, pad = 4) => x > P.minX - pad && x < P.maxX + pad && z > P.minZ - pad && z < P.maxZ + pad;
export const coachSay = (text: string) => useVoice.getState().speakAs('coach', text, 'en-US');

let bannerTimer: number | null = null;

export const useSports = create<SportsStore>((set, get) => ({
  team: '',
  red: 0,
  blue: 0,
  endsAt: 0,
  banner: null,
  reward: null,
  setTeam(team) {
    sendSport({ op: 'team', team });
    set({ team });
    if (team) {
      haptic('light');
      coachSay(team === 'red' ? 'Welcome to the red team! Kick the ball into the far goal.' : 'Welcome to the blue team! Kick the ball into the far goal.');
      track('football_team', { team });
    }
  },
  showBanner(banner) {
    set({ banner });
    if (bannerTimer) window.clearTimeout(bannerTimer);
    if (banner) bannerTimer = window.setTimeout(() => (get().banner === banner ? set({ banner: null }) : undefined), 4000);
  },
}));

const GOAL_LINES = ['Goal! What a shot!', 'Goal! Brilliant!', 'Goal! Fantastic!', 'Goal! Well done!'];

export function initSports() {
  const offMatch = onMatch((m) => useSports.setState({ red: m.red, blue: m.blue, endsAt: m.endsAt }));
  const offSport = onSport((ev: SportEvent) => {
    const s = useSports.getState();
    const near = onPitch(localPos.x, localPos.z, 18);
    if (ev.op === 'kickoff') {
      if (near) coachSay('Kick-off! Good luck, everyone!');
      return;
    }
    if (ev.op === 'goal') {
      if (!near) return;
      const team = ev.team === 'red' ? 'Red' : 'Blue';
      coachSay(`${GOAL_LINES[Math.floor(Math.random() * GOAL_LINES.length)]} ${ev.by} scores for the ${team} team. It's ${ev.red} to ${ev.blue}.`);
      s.showBanner(`⚽ ${t('GOAL!')} ${team} · ${ev.red} : ${ev.blue}`);
      if (s.team === ev.team) haptic('medium');
      return;
    }
    // full time
    if (!near) return;
    const winner = ev.red === ev.blue ? null : ev.red > ev.blue ? 'red' : 'blue';
    coachSay(winner ? `Full time! The ${winner} team wins, ${Math.max(ev.red, ev.blue)} to ${Math.min(ev.red, ev.blue)}. Good game, everyone!` : `Full time! It's a draw, ${ev.red} all. Good game, everyone!`);
    s.showBanner(`🏁 ${t('Full time')} · ${ev.red} : ${ev.blue}`);
    if (!s.team || !onPitch()) return;
    const result = !winner ? 'draw' : winner === s.team ? 'win' : 'lose';
    track('football_final', { result });
    reportMinigame('football', { result })
      .then((r) => {
        useSports.setState({ reward: { ...r, game: 'football' } });
        void useProfile.getState().refresh();
      })
      .catch(() => undefined);
  });
  return () => {
    offMatch();
    offSport();
  };
}
