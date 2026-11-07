import { useEffect, useState } from 'react';
import { RELAY_TARGET, RELAY_TEAMS, type RelayTeam } from '@es/shared';
import { myTeam, useTeamGame } from '../store/teamGame';
import { useGame } from '../store/game';
import { HudButton } from './Hud';
import { Icon } from './icons';
import { useT } from '../i18n';

const TEAM_STYLE: Record<RelayTeam, { name: string; bg: string; text: string; bar: string; ring: string }> = {
  red: { name: 'Red team', bg: 'bg-rose-50', text: 'text-rose-700', bar: 'bg-rose-500', ring: 'ring-rose-300' },
  blue: { name: 'Blue team', bg: 'bg-sky-50', text: 'text-sky-700', bar: 'bg-sky-500', ring: 'ring-sky-300' },
};

/** The HUD button that opens the team games (a dot when a game is waiting for players or running). */
export function TeamGameButton() {
  const t = useT();
  const busy = useTeamGame((s) => !!s.state && (s.state.teams.red.length + s.state.teams.blue.length > 0 || s.state.phase !== 'lobby'));
  return (
    <span className="relative">
      <HudButton onClick={() => useTeamGame.getState().setOpen(true)} title={t('Team games')}>
        <Icon name="trophy" />
      </HudButton>
      {busy ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" /> : null}
    </span>
  );
}

/** Word Relay: the lobby (two teams), the race (questions for whoever has the baton), the result. */
export function TeamGameHud() {
  const t = useT();
  const open = useTeamGame((s) => s.open);
  const st = useTeamGame((s) => s.state);
  const feed = useTeamGame((s) => s.feed);
  const result = useTeamGame((s) => s.result);
  const me = useGame((s) => s.sessionId);
  const g = useTeamGame.getState();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open || !st || (st.phase !== 'countdown' && st.phase !== 'playing')) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [open, st]);
  if (!open) return null;
  const mine = myTeam(st);
  const now = Date.now();
  const card = 'pointer-events-auto max-h-[78dvh] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-40 w-[94vw] max-w-md -translate-x-1/2">
      <div className={card}>
        <div className="mb-2 flex items-center justify-between">
          <b className="flex items-center gap-1.5 text-gray-800">
            <Icon name="trophy" size={18} />
            {t('Word Relay')}
          </b>
          <button type="button" onClick={() => g.setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {!st ? (
          <p className="text-sm text-gray-500">{t('Loading…')}</p>
        ) : st.phase === 'lobby' || (st.phase === 'done' && !mine) ? (
          <>
            <p className="mb-2 text-sm text-gray-600">{t('Two teams race to {n} right answers. Take turns: when you get it right, the next player on your team answers. A wrong answer stops your team for 2 seconds.', { n: RELAY_TARGET })}</p>
            <div className="grid grid-cols-2 gap-2">
              {RELAY_TEAMS.map((team) => (
                <div key={team} className={`rounded-xl p-2 ${TEAM_STYLE[team].bg} ${mine === team ? `ring-2 ${TEAM_STYLE[team].ring}` : ''}`}>
                  <b className={`text-sm ${TEAM_STYLE[team].text}`}>{t(TEAM_STYLE[team].name)}</b>
                  <ul className="my-1 min-h-10 text-sm">
                    {st.teams[team].map((p) => (
                      <li key={p.id} className="truncate">
                        {p.id === me ? '⭐ ' : '• '}
                        {p.name}
                      </li>
                    ))}
                  </ul>
                  {mine !== team ? (
                    <button type="button" onClick={() => g.join(team)} className={`min-h-9 w-full rounded-lg text-sm font-semibold text-white ${TEAM_STYLE[team].bar}`}>
                      {t('Join')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => g.leave()} className="min-h-9 w-full rounded-lg bg-white text-sm">
                      {t('Leave')}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" disabled={!mine || !st.teams.red.length || !st.teams.blue.length || st.phase !== 'lobby'} onClick={() => g.start()} className="mt-2 min-h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40">
              {st.phase !== 'lobby' ? t('A game is running…') : !st.teams.red.length || !st.teams.blue.length ? t('Each team needs at least one player') : t('Start!')}
            </button>
            <p className="mt-1 text-center text-xs text-gray-400">{t('Tell your friends: open 🏆 Team games and join a team.')}</p>
          </>
        ) : st.phase === 'countdown' ? (
          <p className="py-6 text-center text-4xl font-black text-emerald-600">{Math.max(1, Math.ceil((st.startsAt - now) / 1000))}</p>
        ) : (
          <>
            {RELAY_TEAMS.map((team) => (
              <div key={team} className="mb-1.5">
                <div className={`flex justify-between text-xs font-semibold ${TEAM_STYLE[team].text}`}>
                  <span>
                    {t(TEAM_STYLE[team].name)} {mine === team ? `(${t('you')})` : ''}
                  </span>
                  <span>
                    {st.progress[team]}/{RELAY_TARGET}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full transition-[width] ${TEAM_STYLE[team].bar}`} style={{ width: `${(st.progress[team] / RELAY_TARGET) * 100}%` }} />
                </div>
              </div>
            ))}
            {st.phase === 'done' ? (
              <div className="mt-2 text-center">
                <p className="text-2xl font-black">{st.winner === 'draw' ? t("It's a draw!") : st.winner === mine ? `🏆 ${t('Your team won!')}` : t('{team} won!', { team: t(TEAM_STYLE[st.winner as RelayTeam].name) })}</p>
                {result ? <p className="text-sm font-semibold text-green-700">{result.capped ? t('No more rewards for this game today.') : `+${result.xp} XP, +${result.coins} 🪙`}</p> : null}
                <button type="button" onClick={() => g.join(mine ?? 'red')} className="mt-2 min-h-10 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white">
                  {t('Play again')}
                </button>
              </div>
            ) : mine ? (
              <Question team={mine} />
            ) : (
              <p className="mt-2 text-center text-sm text-gray-500">{t('Watching the game…')}</p>
            )}
            {feed.length ? (
              <ul className="mt-2 space-y-0.5 border-t pt-1 text-xs" dir="ltr">
                {[...feed].reverse().map((f) => (
                  <li key={f.at} className={f.team === 'red' ? 'text-rose-700' : 'text-sky-700'}>
                    {f.ok ? '✓' : '✗'} {f.by}: {f.word}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Question({ team }: { team: RelayTeam }) {
  const t = useT();
  const st = useTeamGame((s) => s.state)!;
  const me = useGame((s) => s.sessionId);
  const q = st.question[team];
  const runner = st.teams[team].find((p) => p.id === st.runner[team]);
  const locked = Date.now() < st.lockedUntil[team];
  if (!q) return null;
  if (st.runner[team] !== me)
    return (
      <div className="mt-2 rounded-xl bg-gray-50 p-3 text-center text-sm">
        <p className="text-gray-500">{t('{name} has the baton…', { name: runner?.name ?? '?' })}</p>
        <p className="mt-1 text-3xl" dir="ltr">
          {q.prompt}
        </p>
        <p className="text-xs text-gray-400">{t('Get ready, you could be next!')}</p>
      </div>
    );
  return (
    <div className={`mt-2 rounded-xl p-3 ring-2 ${locked ? 'bg-red-50 ring-red-300' : 'bg-amber-50 ring-amber-300'}`}>
      <p className="text-center text-xs font-semibold text-amber-700">{locked ? t('Wrong! Wait a moment…') : t('Your turn! {q}', { q: q.kind === 'pic' ? t('Which picture is it?') : t('What is it in English?') })}</p>
      <p className={`my-1 text-center font-black ${q.kind === 'pic' ? 'text-2xl' : 'text-5xl'}`} dir="ltr">
        {q.prompt}
      </p>
      <div className="grid grid-cols-2 gap-1.5" dir="ltr">
        {q.options.map((o, i) => (
          <button key={o + i} type="button" disabled={locked} onClick={() => useTeamGame.getState().answer(q.n, i)} className={`min-h-12 rounded-xl border border-gray-200 bg-white font-semibold disabled:opacity-40 ${q.kind === 'pic' ? 'text-3xl' : 'text-sm'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
