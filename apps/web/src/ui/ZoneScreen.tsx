import { Icon } from './icons';
import { useEffect, useState, type FormEvent } from 'react';
import { StreetBackdrop } from './StreetBackdrop';
import { STREET_ROOM_MAX_CLIENTS, ZONE_CODE_RE, ZONE_NAME_MAX, ZONE_NAME_MIN, type ZoneInfo, type ZoneSelection } from '@es/shared';
import { listZones } from '../net/client';
import { useGame } from '../store/game';
import { track } from '../net/analytics';
import { useT } from '../i18n';

/** Full-screen zone picker: join a listed zone (code prompt when locked), create a named zone, or enter a code. */
export function ZoneScreen({ onJoin, onBack, connecting, connError, initial }: { onJoin: (z: ZoneSelection) => void; onBack: () => void; connecting: boolean; connError: string | null; initial?: { id: string; code?: string } }) {
  const t = useT();
  const [zones, setZones] = useState<ZoneInfo[] | null>(null);
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [codeFor, setCodeFor] = useState<ZoneInfo | null>(null);
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await listZones();
      setZones(list);
      // Deep link: the zone must exist; locked zones need a code before we try to join.
      if (initial) {
        const z = list.find((x) => x.id === initial.id);
        if (!z) setError(t('That zone no longer exists. Pick another one below.'));
        else if (z.locked && !initial.code) setCodeFor(z);
        else onJoin({ mode: 'join', id: z.id, code: initial.code });
      }
    } catch {
      setZones([]);
      setError(t('Cannot reach the game server.'));
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void listZones().then(setZones).catch(() => undefined), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const err = (() => {
    if (!connError) return error;
    if (connError.includes('zone_code_required')) return t('Wrong code for that zone.');
    if (connError.includes('account_banned')) return t('Your account has been suspended by a moderator.');
    if (connError.includes('kicked')) return t('A moderator removed you from the street.');
    if (connError.includes('signed_out')) return t('You were signed out. Please sign in again.');
    if (connError.includes('too_many_guests')) return t('Too many guests from your network right now. Sign in to play, or try again later.');
    if (connError.includes('zone_name_invalid')) return t('Pick another zone name (3–24 letters, no bad words).');
    if (connError.includes('zone_code_invalid')) return t('Codes are 4–8 letters or digits.');
    if (/full|locked/i.test(connError)) return t('That zone is full.');
    return t('Could not join: {error}', { error: connError });
  })();

  function join(z: ZoneInfo) {
    if (z.clients >= z.maxClients) return setError(t('That zone is full.'));
    if (z.locked) return setCodeFor(z);
    track('zone_join', { kind: z.kind });
    onJoin({ mode: 'join', id: z.id });
  }
  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!codeFor) return;
    if (!ZONE_CODE_RE.test(code.trim())) return setError(t('Codes are 4–8 letters or digits.'));
    track('zone_join', { kind: 'custom', locked: true });
    onJoin({ mode: 'join', id: codeFor.id, code: code.trim() });
  }
  function submitCreate(e: FormEvent) {
    e.preventDefault();
    const n = name.replace(/\s+/g, ' ').trim();
    if (n.length < ZONE_NAME_MIN || n.length > ZONE_NAME_MAX) return setError(t('Zone name must be {min}–{max} characters.', { min: ZONE_NAME_MIN, max: ZONE_NAME_MAX }));
    if (locked && !ZONE_CODE_RE.test(newCode.trim())) return setError(t('Codes are 4–8 letters or digits.'));
    track('zone_create', { locked });
    onJoin({ mode: 'create', name: n, code: locked ? newCode.trim() : undefined });
  }

  return (
    <div className="relative flex h-full items-center justify-center p-3">
      <StreetBackdrop />
      <div className="relative flex max-h-[92dvh] w-[26rem] max-w-full flex-col rounded-2xl bg-white/95 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('Zones')}</h1>
          <button type="button" onClick={onBack} className="text-sm text-gray-500 underline">
            {t('back')}
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-600">{t('Each zone is its own street with up to {max} people. Join one, or make your own for your class or friends.', { max: STREET_ROOM_MAX_CLIENTS })}</p>
        <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
          {(['join', 'create'] as const).map((k) => (
            <button key={k} type="button" onClick={() => { setTab(k); setError(null); setCodeFor(null); }} className={`flex-1 rounded-lg py-1.5 text-sm ${tab === k ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {k === 'join' ? t('Join a zone') : t('Create a zone')}
            </button>
          ))}
        </div>

        {tab === 'join' && !codeFor && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <button type="button" onClick={() => { track('zone_join', { kind: 'main', quick: true }); onJoin({ mode: 'main' }); }} disabled={connecting} className="mb-2 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">
              {connecting ? t('Connecting…') : t('Play now · Main Street')}
            </button>
            {zones === null && <p className="py-4 text-center text-sm text-gray-500">{t('Loading zones…')}</p>}
            {zones?.length === 0 && <p className="py-4 text-center text-sm text-gray-500">{t('No zones open yet — you will start the first one.')}</p>}
            <ul className="space-y-1.5">
              {zones?.map((z) => {
                const full = z.clients >= z.maxClients;
                return (
                  <li key={z.id}>
                    <button type="button" onClick={() => join(z)} disabled={connecting || full} className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-blue-50 disabled:opacity-50">
                      <span className="text-lg">{z.kind === 'main' ? '🏙️' : z.locked ? '🔒' : '🏘️'}</span>
                      <span className="min-w-0 flex-1">
                        <span dir="auto" className="block truncate text-sm font-semibold">{z.name}</span>
                        <span className="block h-1.5 w-full rounded bg-gray-200">
                          <span className="block h-1.5 rounded bg-green-500" style={{ width: `${Math.min(100, (z.clients / Math.max(1, z.maxClients)) * 100)}%` }} />
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-gray-600">
                        {z.clients}/{z.maxClients}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-blue-700">{full ? t('Full') : t('Join')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tab === 'join' && codeFor && (
          <form onSubmit={submitCode}>
            <p className="mb-2 text-sm">
              {t('{zone} is private. Enter its code:').split('{zone}').map((part, i) => (i === 0 ? part : <span key={i}><b dir="auto">{codeFor.name}</b>{part}</span>))}
            </p>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Code')} maxLength={8} autoFocus autoComplete="off" className="mb-2 w-full rounded-lg border px-3 py-2 font-mono uppercase" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setCodeFor(null)} className="flex-1 rounded-lg border py-2 text-sm">
                {t('Back')}
              </button>
              <button type="submit" disabled={connecting} className="flex-1 rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">
                {connecting ? t('Connecting…') : t('Join')}
              </button>
            </div>
          </form>
        )}

        {tab === 'create' && (
          <form onSubmit={submitCreate}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Zone name (e.g. Class 10A)')} maxLength={ZONE_NAME_MAX} autoFocus className="mb-2 w-full rounded-lg border px-3 py-2" />
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> {t('Private (needs a code)')}
            </label>
            {locked && <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder={t('Code (4–8 letters/digits)')} maxLength={8} autoComplete="off" className="mb-2 w-full rounded-lg border px-3 py-2 font-mono" />}
            <p className="mb-2 text-xs text-gray-500">{t('The zone closes by itself once everyone has left. Share its link from the zone chip in the game.')}</p>
            <button type="submit" disabled={connecting} className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">
              {connecting ? t('Creating…') : t('Create & enter')}
            </button>
          </form>
        )}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}

/** HUD chip: zone name + player count; tap for the share link and "change zone". */
export function ZoneChip({ compact, onChange }: { compact: boolean; onChange: () => void }) {
  const zone = useGame((s) => s.zone);
  const count = useGame((s) => Object.keys(s.players).length);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useT();
  if (!zone) return null;
  const link = `${location.origin}${location.pathname}?zone=${zone.id}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt(t('Copy this link'), link);
    }
  }
  return (
    <div data-ui className={`absolute ${compact ? 'hud-top ' : ''}${compact ? 'left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(max(0.75rem,env(safe-area-inset-top))+3.1rem)]' : 'left-3 top-14'} text-xs`}>
      <button type="button" onClick={() => setOpen((o) => !o)} title={t('Zone')} className="flex min-h-8 items-center gap-1.5 rounded-full bg-black/50 px-3 text-white backdrop-blur-sm">
        <Icon name="pin" size={15} />
        <span dir="auto" className="max-w-28 truncate font-semibold">{zone.name}</span>
        <span className="opacity-80">· {count}</span>
      </button>
      {open && (
        <div className="mt-1 w-56 rounded-xl bg-white p-2 text-gray-800 shadow-lg">
          <p className="mb-1 px-1 text-[11px] text-gray-500">
            {zone.locked ? t('{count} / {max} people here · private', { count, max: STREET_ROOM_MAX_CLIENTS }) : t('{count} / {max} people here', { count, max: STREET_ROOM_MAX_CLIENTS })}
          </p>
          <button type="button" onClick={() => void copy()} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-gray-100">
            {copied ? `✅ ${t('Link copied')}` : `🔗 ${t('Copy invite link')}`}
          </button>
          <button type="button" onClick={() => { setOpen(false); onChange(); }} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-gray-100">
            🚪 {t('Change zone')}
          </button>
        </div>
      )}
    </div>
  );
}
