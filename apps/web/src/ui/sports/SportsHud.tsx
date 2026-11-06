import { useEffect, useState } from 'react';
import { sendShout } from '../../net/client';
import { useT } from '../../i18n';
import { onPitch, useSports } from '../../store/sports';
import { useMini } from '../../store/minigames';

/** Quick things to shout on the pitch (in English, heard by everyone near). */
const SHOUTS = ['Pass!', 'Shoot!', 'Over here!', 'Good job!', 'My ball!', 'Nice try!'];

/** True while I am on or near the football pitch (checked twice a second). */
function useOnPitch() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = onPitch();
      setOn(now);
      // walked away from the park: leave the team
      if (!onPitch(undefined, undefined, 30) && useSports.getState().team) useSports.getState().setTeam('');
    }, 500);
    return () => window.clearInterval(id);
  }, []);
  return on;
}

/** Football HUD: the score, goal / full-time banners, quick shouts for my team, and the match reward. */
export function SportsHud() {
  const t = useT();
  const on = useOnPitch();
  const team = useSports((s) => s.team);
  const red = useSports((s) => s.red);
  const blue = useSports((s) => s.blue);
  const banner = useSports((s) => s.banner);
  const reward = useSports((s) => s.reward);
  const mini = useMini((s) => s.game);
  if ((!on && !reward) || mini) return null;
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 flex w-[92vw] max-w-sm -translate-x-1/2 flex-col items-center gap-2">
      {on ? (
        <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-1 text-sm font-semibold text-white shadow" dir="ltr">
          <span className={team === 'red' ? 'underline' : ''} style={{ color: '#ff8a7a' }}>
            RED {red}
          </span>
          <span>:</span>
          <span className={team === 'blue' ? 'underline' : ''} style={{ color: '#8ec5ff' }}>
            {blue} BLUE
          </span>
        </div>
      ) : null}
      {banner ? <div className="rounded-xl bg-yellow-300 px-4 py-2 text-base font-bold text-black shadow-xl">{banner}</div> : null}
      {reward ? (
        <button type="button" onClick={() => useSports.setState({ reward: null })} className="pointer-events-auto rounded-xl bg-white px-4 py-2 text-sm shadow-xl">
          {reward.capped ? t('Good game! (No more rewards for this game today.)') : t('Good game! +{xp} XP, +{coins} coins', { xp: reward.xp, coins: reward.coins })} ✕
        </button>
      ) : null}
      {on && team ? (
        <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5" dir="ltr">
          {SHOUTS.map((s) => (
            <button key={s} type="button" onClick={() => sendShout(s)} className="min-h-9 rounded-full bg-white/90 px-3 text-xs font-medium shadow">
              {s}
            </button>
          ))}
        </div>
      ) : on ? (
        <div className="rounded-lg bg-black/50 px-3 py-1 text-xs text-white">{t('Walk to a team sign to join, then walk into the ball or press Kick.')}</div>
      ) : null}
    </div>
  );
}
