import { useEffect, useState, type FormEvent } from 'react';
import { useProfile } from '../store/profile';
import { fetchConfig, verifyBetaCode } from '../net/api';
import { getBetaPass, setBetaPass } from '../net/player';
import { useT } from '../i18n';
import { LanguagePicker } from './SettingsPanel';

type Mode = 'guest' | 'login' | 'register';

export function AuthScreen({ initialName, onPlay, onZones, connecting, connError }: { initialName: string; onPlay: (name: string) => void; onZones?: (name: string) => void; connecting: boolean; connError: string | null }) {
  const t = useT();
  const { loggedIn, profile, login, register, logout } = useProfile();
  const [mode, setMode] = useState<Mode>(loggedIn ? 'login' : 'guest');
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [betaGate, setBetaGate] = useState(false);
  const [invite, setInvite] = useState('');
  useEffect(() => {
    fetchConfig()
      .then((c) => setBetaGate(c.betaGate))
      .catch(() => undefined);
  }, []);
  // The game server refused us for lack of a beta pass: the stored pass (if any) is stale, ask for a code.
  const gateRefused = !!connError && connError.includes('beta_pass_required');
  useEffect(() => {
    if (gateRefused) {
      setBetaPass(null);
      setBetaGate(true);
    }
  }, [gateRefused]);
  const needCode = betaGate && !getBetaPass() && !loggedIn;

  /** 'play' enters Main Street right away; 'zones' opens the zone picker (join a friend's zone or create one). */
  const [intent, setIntent] = useState<'play' | 'zones'>('play');
  const go = (n: string) => (intent === 'zones' && onZones ? onZones(n) : onPlay(n));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (needCode) {
      if (!invite.trim()) return setError(t('Please enter your invite code.'));
      setBusy(true);
      try {
        setBetaPass((await verifyBetaCode(invite.trim())).pass);
      } catch (err) {
        setBusy(false);
        return setError((err as Error).message);
      }
      setBusy(false);
    }
    if (loggedIn && profile) return go(profile.name);
    if (mode === 'guest') {
      if (name.trim().length < 2) return setError(t('Name must be at least 2 characters.'));
      return go(name.trim());
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name.trim());
      go(useProfile.getState().profile?.name ?? name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const Tab = ({ m, label }: { m: Mode; label: string }) => (
    <button type="button" onClick={() => setMode(m)} className={`flex-1 rounded-lg py-1.5 text-sm ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {label}
    </button>
  );

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={submit} className="w-[22rem] rounded-2xl bg-white/95 p-6 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold">
          English Street {betaGate && <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-purple-700">BETA</span>}
        </h1>
        <p className="mb-4 text-sm text-gray-600">{t('Walk the street. Talk in English.')}</p>
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <label htmlFor="auth-lang" className="shrink-0">{t('My language')}</label>
          <LanguagePicker id="auth-lang" className="min-w-0 flex-1" />
        </div>

        {loggedIn && profile ? (
          <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {t('Signed in as {name}').split('{name}').map((part, i) => (i === 0 ? part : <span key={i}><b>{profile.name}</b>{part}</span>))} · {t('Level {level}', { level: profile.level })} · {profile.cefrLevel}
            <button type="button" onClick={logout} className="ml-2 text-xs underline">
              {t('sign out')}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
              <Tab m="guest" label={t('Guest')} />
              <Tab m="login" label={t('Sign in')} />
              <Tab m="register" label={t('Sign up')} />
            </div>
            {mode !== 'login' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Your name')} maxLength={20} autoFocus className="mb-2 w-full rounded-lg border px-3 py-2" />}
            {mode !== 'guest' && (
              <>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('Email')} autoComplete="email" className="mb-2 w-full rounded-lg border px-3 py-2" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('Password (6+ characters)')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="mb-2 w-full rounded-lg border px-3 py-2" />
              </>
            )}
            {mode === 'guest' && <p className="mb-2 text-xs text-gray-500">{t('Guest progress stays in this browser. Sign up later to keep it.')}</p>}
          </>
        )}
        {needCode && (
          <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={t('Invite code (closed beta)')} maxLength={64} autoComplete="off" className="mb-2 w-full rounded-lg border border-purple-300 bg-purple-50 px-3 py-2" />
        )}

        <button type="submit" onClick={() => setIntent('play')} disabled={connecting || busy} className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">
          {connecting ? t('Connecting…') : busy ? t('Please wait…') : mode === 'register' && !loggedIn ? t('Create account & play') : t('Enter the street')}
        </button>
        {onZones && (
          <button type="submit" onClick={() => setIntent('zones')} disabled={connecting || busy} className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">
            {t('Choose or create a zone…')}
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {connError && !error && (
          <p className="mt-2 text-sm text-red-600">{gateRefused ? t('English Street is in closed beta — please enter your invite code.') : t('Cannot reach the game server. Is it running?')}</p>
        )}
      </form>
    </div>
  );
}
