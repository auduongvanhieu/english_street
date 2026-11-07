import { useEffect, useRef, useState } from 'react';
import { HARVEST_ITEMS, RUSH_MENU, RUSH_TABLES, TEAM_GAMES, TEAM_GAME_IDS, TEAM_IDS, ticketText, type RushTicket, type TeamId, type TeamState } from '@es/shared';
import { myTeam, useTeamGame, type Stroke } from '../store/teamGame';
import { useGame } from '../store/game';
import { useVoice } from '../store/voice';
import { HudButton } from './Hud';
import { Icon } from './icons';
import { useT } from '../i18n';

const TEAM_STYLE: Record<TeamId, { name: string; bg: string; text: string; bar: string; ring: string }> = {
  red: { name: 'Red team', bg: 'bg-rose-50', text: 'text-rose-700', bar: 'bg-rose-500', ring: 'ring-rose-300' },
  blue: { name: 'Blue team', bg: 'bg-sky-50', text: 'text-sky-700', bar: 'bg-sky-500', ring: 'ring-sky-300' },
};
const say = (s: string) => useVoice.getState().speakAs('me', s, 'en-US');

/** The HUD button that opens the team games (a dot when somebody is in a team or a game is running). */
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

/** Team games: the lobby (game, teams), the game being played, the result. */
export function TeamGameHud() {
  const t = useT();
  const open = useTeamGame((s) => s.open);
  const st = useTeamGame((s) => s.state);
  const feed = useTeamGame((s) => s.feed);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open || !st || (st.phase !== 'countdown' && st.phase !== 'playing')) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [open, st]);
  if (!open) return null;
  const mine = myTeam(st);
  const g = useTeamGame.getState();
  const info = st ? TEAM_GAMES[st.game] : null;
  // the treasure hunt: a small card, so you can walk around
  const small = st?.game === 'hunt' && st.phase === 'playing' && !!mine;
  return (
    <div data-ui className={`pointer-events-none absolute z-40 ${small ? 'left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(max(0.75rem,env(safe-area-inset-top))+5.4rem)] w-[min(20rem,70vw)] sm:top-[9.4rem]' : 'left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] w-[94vw] max-w-md -translate-x-1/2'}`}>
      <div className="pointer-events-auto max-h-[80dvh] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <b className="flex items-center gap-1.5 text-gray-800">
            <Icon name="trophy" size={18} />
            {info && st?.phase !== 'lobby' ? `${info.icon} ${t(info.name)}` : t('Team games')}
          </b>
          <button type="button" onClick={() => g.setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {!st ? (
          <p className="text-sm text-gray-500">{t('Loading…')}</p>
        ) : st.phase === 'lobby' || (st.phase === 'done' && !mine) ? (
          <Lobby st={st} mine={mine} />
        ) : st.phase === 'countdown' ? (
          <div className="py-4 text-center">
            <p className="text-sm text-gray-600">{t(TEAM_GAMES[st.game].about)}</p>
            <p className="mt-2 text-5xl font-black text-emerald-600">{Math.max(1, Math.ceil((st.startsAt - Date.now()) / 1000))}</p>
          </div>
        ) : (
          <>
            <Scores st={st} mine={mine} />
            {st.phase === 'done' ? (
              <Result st={st} mine={mine} />
            ) : !mine ? (
              <p className="mt-2 text-center text-sm text-gray-500">{t('Watching the game…')}</p>
            ) : st.game === 'relay' ? (
              <RelayView st={st} team={mine} />
            ) : st.game === 'hunt' ? (
              <HuntView st={st} team={mine} />
            ) : st.game === 'rush' ? (
              <RushView st={st} team={mine} />
            ) : st.game === 'harvest' ? (
              <HarvestView st={st} team={mine} />
            ) : (
              <DrawView st={st} team={mine} />
            )}
            {st.game === 'draw' && !mine && st.phase === 'playing' ? <Canvas readOnly /> : null}
            {feed.length && !small ? (
              <ul className="mt-2 space-y-0.5 border-t pt-1 text-xs" dir="ltr">
                {[...feed].reverse().map((f) => (
                  <li key={f.at} className={f.team === 'red' ? 'text-rose-700' : 'text-sky-700'}>
                    {f.ok ? '✓' : '✗'} {f.by}: {f.text}
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

function Lobby({ st, mine }: { st: TeamState; mine: TeamId | null }) {
  const t = useT();
  const me = useGame((s) => s.sessionId);
  const g = useTeamGame.getState();
  return (
    <>
      <div className="mb-2 grid grid-cols-5 gap-1">
        {TEAM_GAME_IDS.map((id) => (
          <button key={id} type="button" disabled={!mine} onClick={() => g.pick(id)} title={t(TEAM_GAMES[id].name)} className={`flex min-h-14 flex-col items-center justify-center rounded-xl p-1 text-[10px] font-semibold leading-tight ${st.game === id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-slate-700'} disabled:opacity-70`}>
            <span className="text-xl">{TEAM_GAMES[id].icon}</span>
            <span className="line-clamp-2">{t(TEAM_GAMES[id].name)}</span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm text-gray-600">
        <b>{t(TEAM_GAMES[st.game].name)}:</b> {t(TEAM_GAMES[st.game].about)}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TEAM_IDS.map((team) => (
          <div key={team} className={`rounded-xl p-2 ${TEAM_STYLE[team].bg} ${mine === team ? `ring-2 ${TEAM_STYLE[team].ring}` : ''}`}>
            <b className={`text-sm ${TEAM_STYLE[team].text}`}>{t(TEAM_STYLE[team].name)}</b>
            <ul className="my-1 min-h-10 text-sm">
              {st.teams[team].map((p) => (
                <li key={p.id} className="truncate">
                  {p.id === me ? '⭐ ' : p.bot ? '🤖 ' : '• '}
                  {p.name}
                </li>
              ))}
            </ul>
            {mine !== team ? (
              <button type="button" onClick={() => g.join(team)} className={`min-h-9 w-full rounded-lg text-sm font-semibold text-white ${TEAM_STYLE[team].bar}`}>
                {t('Join')}
              </button>
            ) : (
              <button type="button" onClick={() => g.send({ op: 'leave' })} className="min-h-9 w-full rounded-lg bg-white text-sm">
                {t('Leave')}
              </button>
            )}
            {mine && st.game !== 'draw' ? (
              <div className="mt-1 flex gap-1 text-xs">
                <button type="button" onClick={() => g.send({ op: 'bot', team })} className="min-h-8 flex-1 rounded-lg bg-white/80">
                  + 🤖
                </button>
                {st.teams[team].some((p) => p.bot) ? (
                  <button type="button" onClick={() => g.send({ op: 'kickbot', team })} className="min-h-8 flex-1 rounded-lg bg-white/80">
                    − 🤖
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!mine ? (
        <button type="button" onClick={() => g.send({ op: 'quick' })} className="mt-2 min-h-10 w-full rounded-xl bg-amber-500 text-sm font-bold text-white">
          ⚡ {t('Quick join')}
        </button>
      ) : null}
      <p className="mt-1 text-center text-xs text-gray-500">{st.game === 'draw' ? t('Draw & Guess needs real players (two in a team).') : t('Not enough players? Add a robot 🤖 to a team.')}</p>
      <button type="button" disabled={!mine || !st.teams.red.length || !st.teams.blue.length || st.phase !== 'lobby'} onClick={() => g.start()} className="mt-2 min-h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40">
        {st.phase !== 'lobby' ? t('A game is running…') : !st.teams.red.length || !st.teams.blue.length ? t('Each team needs at least one player') : t('Start!')}
      </button>
      <p className="mt-1 text-center text-xs text-gray-400">{t('Tell your friends: open 🏆 Team games and join a team.')}</p>
    </>
  );
}

function Scores({ st, mine }: { st: TeamState; mine: TeamId | null }) {
  const t = useT();
  const target = TEAM_GAMES[st.game].target;
  const left = Math.max(0, Math.ceil((st.endsAt - Date.now()) / 1000));
  return (
    <div className="mb-1">
      {TEAM_IDS.map((team) => (
        <div key={team} className="mb-1">
          <div className={`flex justify-between text-xs font-semibold ${TEAM_STYLE[team].text}`}>
            <span>
              {t(TEAM_STYLE[team].name)} {mine === team ? `(${t('you')})` : ''}
            </span>
            <span>{st.game === 'draw' ? `${st.score[team]} ${t('points')}` : `${st.score[team]}/${target}`}</span>
          </div>
          {st.game !== 'draw' ? (
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full transition-[width] ${TEAM_STYLE[team].bar}`} style={{ width: `${(st.score[team] / target) * 100}%` }} />
            </div>
          ) : null}
        </div>
      ))}
      {st.phase === 'playing' ? <p className="text-right text-[11px] text-gray-400">⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p> : null}
    </div>
  );
}

function Result({ st, mine }: { st: TeamState; mine: TeamId | null }) {
  const t = useT();
  const result = useTeamGame((s) => s.result);
  const g = useTeamGame.getState();
  return (
    <div className="mt-2 text-center">
      <p className="text-2xl font-black">{st.winner === 'draw' ? t("It's a draw!") : st.winner === mine ? `🏆 ${t('Your team won!')}` : t('{team} won!', { team: t(TEAM_STYLE[st.winner as TeamId].name) })}</p>
      {result ? <p className="text-sm font-semibold text-green-700">{result.capped ? t('No more rewards for this game today.') : `+${result.xp} XP, +${result.coins} 🪙`}</p> : null}
      <button type="button" onClick={() => g.join(mine ?? 'red')} className="mt-2 min-h-10 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white">
        {t('Play again')}
      </button>
    </div>
  );
}

const turnName = (st: TeamState, team: TeamId) => st.teams[team].find((p) => p.id === st.turn[team])?.name ?? '?';
function Waiting({ text, prompt }: { text: string; prompt?: string }) {
  return (
    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-center text-sm">
      <p className="text-gray-500">{text}</p>
      {prompt ? (
        <p className="mt-1 text-2xl" dir="ltr">
          {prompt}
        </p>
      ) : null}
    </div>
  );
}
const lockedNow = (st: TeamState, team: TeamId) => Date.now() < st.locked[team];

/* ---------------------------------------------------------------------------------------- relay */
function RelayView({ st, team }: { st: TeamState; team: TeamId }) {
  const t = useT();
  const me = useGame((s) => s.sessionId);
  const q = st.relay?.[team];
  if (!q) return null;
  if (st.turn[team] !== me) return <Waiting text={t('{name} has the baton…', { name: turnName(st, team) })} prompt={q.prompt} />;
  const locked = lockedNow(st, team);
  return (
    <div className={`mt-2 rounded-xl p-3 ring-2 ${locked ? 'bg-red-50 ring-red-300' : 'bg-amber-50 ring-amber-300'}`}>
      <p className="text-center text-xs font-semibold text-amber-700">{locked ? t('Wrong! Wait a moment…') : t('Your turn! {q}', { q: q.kind === 'pic' ? t('Which picture is it?') : t('What is it in English?') })}</p>
      <p className={`my-1 text-center font-black ${q.kind === 'pic' ? 'text-2xl' : 'text-5xl'}`} dir="ltr">
        {q.prompt}
      </p>
      <div className="grid grid-cols-2 gap-1.5" dir="ltr">
        {q.options.map((o, i) => (
          <button key={o + i} type="button" disabled={locked} onClick={() => useTeamGame.getState().send({ op: 'relay', n: q.n, choice: i })} className={`min-h-12 rounded-xl border border-gray-200 bg-white font-semibold disabled:opacity-40 ${q.kind === 'pic' ? 'text-3xl' : 'text-sm'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- hunt */
function HuntView({ st, team }: { st: TeamState; team: TeamId }) {
  const t = useT();
  const h = st.hunt?.[team];
  if (!h) return null;
  return (
    <div className="mt-1 rounded-xl bg-amber-50 p-2 ring-2 ring-amber-300">
      <p className="text-[11px] font-semibold text-amber-700">
        {t('Clue {n} of {total}', { n: h.n + 1, total: TEAM_GAMES.hunt.target })} {h.last ? `· ${t('{name} found the last one!', { name: h.last })}` : ''}
      </p>
      <p className="my-1 text-sm font-bold leading-snug" dir="ltr">
        {h.clue}{' '}
        <button type="button" onClick={() => say(h.clue)} className="align-middle" aria-label={t('Listen')}>
          <Icon name="speaker" size={15} />
        </button>
      </p>
      <p className="text-[11px] text-gray-500">{t('Anyone on your team can go there. Walk, take the bus or a taxi!')}</p>
      <button type="button" onClick={() => useGame.getState().setUiPanel('map')} className="mt-1 flex min-h-8 w-full items-center justify-center gap-1 rounded-lg bg-white text-xs font-semibold ring-1 ring-black/5">
        <Icon name="map" size={14} /> {t('Map')}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- rush */
function RushView({ st, team }: { st: TeamState; team: TeamId }) {
  const t = useT();
  const me = useGame((s) => s.sessionId);
  const r = st.rush?.[team];
  const [ticket, setTicket] = useState<RushTicket>({});
  const key = r ? `${r.n}-${r.step}` : '';
  useEffect(() => {
    setTicket({});
    // the waiter hears the customer; the server hears it again before serving
    if (r && st.turn[team] === useGame.getState().sessionId && r.step !== 'cook') say(r.order.sentence);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;
  const roleText = r.step === 'order' ? t('Waiter: take the order') : r.step === 'cook' ? t('Cook: make the food on the ticket') : t('Server: take it to the right table');
  if (st.turn[team] !== me) return <Waiting text={`${turnName(st, team)} · ${roleText}`} prompt={r.step === 'serve' ? '🍽️' : r.step === 'cook' ? '👩‍🍳' : '📝'} />;
  const locked = lockedNow(st, team);
  const add = (id: string, d: number) => setTicket((x) => ({ ...x, [id]: Math.max(0, Math.min(3, (x[id] ?? 0) + d)) }));
  const send = (extra: { ticket?: RushTicket; table?: number }) => useTeamGame.getState().send({ op: 'rush', n: r.n, step: r.step, ...extra });
  return (
    <div className={`mt-2 rounded-xl p-2 ring-2 ${locked ? 'bg-red-50 ring-red-300' : 'bg-amber-50 ring-amber-300'}`}>
      <p className="text-center text-xs font-semibold text-amber-700">{locked ? t('Wrong! Wait a moment…') : `${t('Your turn!')} ${roleText}`}</p>
      {r.step === 'order' ? (
        <p className="my-1 rounded-lg bg-white p-2 text-sm" dir="ltr">
          🗣️ “{r.order.sentence}”
        </p>
      ) : r.step === 'cook' ? (
        <p className="my-1 rounded-lg border-2 border-dashed border-amber-400 bg-white p-2 text-center font-mono text-sm" dir="ltr">
          🧾 {ticketText(r.ticket ?? {})}
        </p>
      ) : (
        <p className="my-1 text-center text-sm" dir="ltr">
          <button type="button" onClick={() => say(r.order.sentence)} className="rounded-lg bg-white px-3 py-1 font-semibold ring-1 ring-black/5">
            🔊 {t('Listen to the order again')}
          </button>
        </p>
      )}
      {r.step === 'serve' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: RUSH_TABLES }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" disabled={locked} onClick={() => send({ table: n })} className="min-h-11 rounded-xl border border-gray-200 bg-white text-sm font-bold disabled:opacity-40" dir="ltr">
              Table {n}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1" dir="ltr">
            {RUSH_MENU.map((m) => (
              <div key={m.id} className={`flex flex-col items-center rounded-lg p-1 text-[10px] ${ticket[m.id] ? 'bg-emerald-100' : 'bg-white'}`}>
                <button type="button" disabled={locked} onClick={() => add(m.id, 1)} className="text-2xl">
                  {m.icon}
                </button>
                {/* the waiter writes words; the cook picks pictures */}
                <span className="truncate">{r.step === 'order' ? m.en.replace(/^(a|an|some) /, '') : ''}</span>
                {ticket[m.id] ? (
                  <button type="button" onClick={() => add(m.id, -1)} className="text-xs font-bold text-emerald-800">
                    ×{ticket[m.id]} −
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button type="button" disabled={locked || !Object.values(ticket).some((v) => v > 0)} onClick={() => send({ ticket })} className="mt-1.5 min-h-10 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40">
            {r.step === 'order' ? t('Send the ticket to the kitchen') : t('The food is ready!')}
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- harvest */
function HarvestView({ st, team }: { st: TeamState; team: TeamId }) {
  const t = useT();
  const h = st.harvest?.[team];
  const n = h?.n;
  useEffect(() => {
    if (h) say(h.text);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!h) return null;
  const locked = lockedNow(st, team);
  return (
    <div className={`mt-2 rounded-xl p-2 ring-2 ${locked ? 'bg-red-50 ring-red-300' : 'bg-lime-50 ring-lime-300'}`}>
      <p className="text-center text-base font-black" dir="ltr">
        {h.text}{' '}
        <button type="button" onClick={() => say(h.text)} className="align-middle" aria-label={t('Listen')}>
          <Icon name="speaker" size={16} />
        </button>
      </p>
      <p className="mb-1 text-center text-[11px] text-gray-500">{locked ? t('Wrong! Wait a moment…') : t('Everybody on your team can pick at the same time. {n} to go.', { n: h.need - h.picked.length })}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {h.grid.map((id, i) => {
          const done = h.picked.includes(i);
          return (
            <button key={i} type="button" disabled={locked || done} onClick={() => useTeamGame.getState().send({ op: 'harvest', n: h.n, index: i })} className={`flex min-h-14 items-center justify-center rounded-xl text-3xl ${done ? 'bg-emerald-200 opacity-50' : 'bg-white ring-1 ring-black/5'} disabled:cursor-default`}>
              {HARVEST_ITEMS.find((x) => x.id === id)?.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- draw */
function DrawView({ st, team }: { st: TeamState; team: TeamId }) {
  const t = useT();
  const me = useGame((s) => s.sessionId);
  const word = useTeamGame((s) => s.word);
  const [guess, setGuess] = useState('');
  const d = st.draw;
  if (!d) return null;
  const drawer = st.teams[d.team].find((p) => p.id === d.drawer)?.name ?? '?';
  const mineDraw = d.drawer === me;
  const myTurnGuess = d.team === team && !mineDraw && !d.word;
  const left = Math.max(0, Math.ceil((d.endsAt - Date.now()) / 1000));
  return (
    <div className="mt-1">
      <p className="text-center text-xs text-gray-600">
        {t('Round {n} of {total}', { n: d.round + 1, total: TEAM_GAMES.draw.target })} · {d.word ? (d.guessed ? t('{name} guessed it!', { name: d.guessed }) : t('Time is up!')) : `⏱ ${left}s`}
      </p>
      {d.word ? (
        <p className="text-center text-xl font-black text-emerald-700" dir="ltr">
          {d.word}
        </p>
      ) : mineDraw ? (
        <p className="text-center text-sm">
          {t('Draw this:')} <b className="text-lg" dir="ltr">{word}</b> <span className="text-xs text-gray-500">({t('no letters!')})</span>
        </p>
      ) : (
        <p className="text-center text-sm text-gray-600">{d.team === team ? t('{name} is drawing. What is it?', { name: drawer }) : t('The other team is guessing. Watch!')}</p>
      )}
      <Canvas readOnly={!mineDraw || !!d.word} />
      {myTurnGuess ? (
        <form
          className="mt-1.5 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!guess.trim()) return;
            useTeamGame.getState().send({ op: 'guess', text: guess });
            setGuess('');
          }}
        >
          <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder={t('Type your guess in English')} className="min-h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm" dir="ltr" autoComplete="off" />
          <button type="submit" className="min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">
            {t('Guess')}
          </button>
        </form>
      ) : null}
    </div>
  );
}

const COLORS = ['#222222', '#e53935', '#1e88e5', '#43a047', '#fb8c00'];
/** The shared drawing: strokes in 0…1000 coordinates; the drawer draws with a finger or the mouse. */
function Canvas({ readOnly }: { readOnly?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useTeamGame((s) => s.strokes);
  const [color, setColor] = useState(COLORS[0]!);
  const cur = useRef<number[] | null>(null);
  const drawAll = (list: Stroke[], extra?: Stroke) => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    for (const s of extra ? [...list, extra] : list) {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      for (let i = 0; i + 1 < s.pts.length; i += 2) {
        const x = (s.pts[i]! / 1000) * c.width;
        const y = (s.pts[i + 1]! / 1000) * c.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (s.pts.length === 2) ctx.lineTo((s.pts[0]! / 1000) * c.width + 0.1, (s.pts[1]! / 1000) * c.height);
      ctx.stroke();
    }
  };
  useEffect(() => drawAll(strokes), [strokes]);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
  };
  const flush = () => {
    const pts = cur.current;
    if (pts && pts.length >= 2) useTeamGame.getState().send({ op: 'stroke', pts: pts.slice(0, 160), color });
  };
  return (
    <div className="mt-1">
      <canvas
        ref={ref}
        width={600}
        height={420}
        className={`aspect-[10/7] w-full touch-none rounded-xl border-2 bg-white ${readOnly ? 'border-gray-200' : 'border-emerald-400'}`}
        onPointerDown={(e) => {
          if (readOnly) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          cur.current = point(e);
        }}
        onPointerMove={(e) => {
          if (readOnly || !cur.current) return;
          cur.current.push(...point(e));
          drawAll(strokes, { pts: cur.current, color });
          // long lines go out in pieces
          if (cur.current.length >= 150) {
            flush();
            cur.current = cur.current.slice(-2);
          }
        }}
        onPointerUp={() => {
          if (readOnly) return;
          flush();
          cur.current = null;
        }}
      />
      {!readOnly ? (
        <div className="mt-1 flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-offset-1 ring-slate-500' : ''}`} style={{ background: c }} aria-label={c} />
          ))}
          <button type="button" onClick={() => useTeamGame.getState().send({ op: 'clear' })} className="ms-auto min-h-8 rounded-lg bg-gray-100 px-3 text-xs">
            {t('Clear')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
