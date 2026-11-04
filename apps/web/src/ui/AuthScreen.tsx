import { useEffect, useState, type FormEvent } from 'react';
import { useProfile } from '../store/profile';
import {
  fetchCaptcha,
  fetchConfig,
  guestPass,
  verifyBetaCode,
  type CaptchaAnswer,
} from '../net/api';
import { getBetaPass, getHumanPass, setBetaPass, setHumanPass } from '../net/player';
import { useT } from '../i18n';
import { LanguagePicker } from './SettingsPanel';
import { Turnstile } from './Turnstile';

type Mode = 'guest' | 'login' | 'register';

export function AuthScreen({
  initialName,
  onPlay,
  onZones,
  connecting,
  connError,
}: {
  initialName: string;
  onPlay: (name: string) => void;
  onZones?: (name: string) => void;
  connecting: boolean;
  connError: string | null;
}) {
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
  const [showPw, setShowPw] = useState(false);
  const [cap, setCap] = useState<{ id: string; svg: string } | null>(null);
  const [capAnswer, setCapAnswer] = useState('');
  // Sign-in / sign-up always; guests once, then their human pass (30 days) is enough.
  const [hasPass, setHasPass] = useState(() => !!getHumanPass());
  const needCaptcha = !loggedIn && (mode !== 'guest' || !hasPass);
  // Cloudflare Turnstile when configured; the built-in image captcha when not, or when Turnstile can't load here.
  const [siteKey, setSiteKey] = useState('');
  const [tsFailed, setTsFailed] = useState(false);
  const [tsToken, setTsToken] = useState('');
  const [tsReset, setTsReset] = useState(0);
  const [configLoaded, setConfigLoaded] = useState(false);
  const useTs = !!siteKey && !tsFailed;
  async function newCaptcha() {
    setCapAnswer('');
    try {
      setCap(await fetchCaptcha());
    } catch {
      setCap(null);
    }
  }
  useEffect(() => {
    if (needCaptcha && configLoaded && !useTs && !cap) void newCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needCaptcha, configLoaded, useTs]);
  useEffect(() => {
    fetchConfig()
      .then((c) => {
        setBetaGate(c.betaGate);
        setSiteKey(c.turnstileSiteKey ?? '');
      })
      .catch(() => undefined)
      .finally(() => setConfigLoaded(true));
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
  // The street refused a missing / expired guest pass: show the security check again.
  const humanRefused = !!connError && connError.includes('human_check_required');
  useEffect(() => {
    if (humanRefused) setHasPass(false);
  }, [humanRefused]);

  /** 'play' enters Main Street right away; 'zones' opens the zone picker (join a friend's zone or create one). */
  const [intent, setIntent] = useState<'play' | 'zones'>('play');
  const go = (n: string) => (intent === 'zones' && onZones ? onZones(n) : onPlay(n));

  /** The filled-in human check, or null (with an error shown) when it isn't done yet. */
  function humanAnswer(): CaptchaAnswer | null {
    if (useTs) {
      if (tsToken) return { turnstileToken: tsToken };
      setError(t('Please complete the security check.'));
      return null;
    }
    if (cap && capAnswer.trim()) return { captchaId: cap.id, captchaAnswer: capAnswer.trim() };
    setError(t('Please type the security code.'));
    return null;
  }
  /** Every Turnstile token / image code can be checked once: get a fresh one after a failed attempt. */
  function resetCheck() {
    if (useTs) setTsReset((n) => n + 1);
    else void newCaptcha();
  }

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
      if (!getHumanPass()) {
        const c = humanAnswer();
        if (!c) return;
        setBusy(true);
        try {
          setHumanPass((await guestPass(c)).pass);
          setHasPass(true);
        } catch (err) {
          setError((err as Error).message);
          resetCheck();
          return;
        } finally {
          setBusy(false);
        }
      }
      return go(name.trim());
    }
    setBusy(true);
    try {
      const c = humanAnswer();
      if (!c) {
        setBusy(false);
        return;
      }
      if (mode === 'login') await login(email, password, c);
      else await register(email, password, name.trim(), c);
      go(useProfile.getState().profile?.name ?? name.trim());
    } catch (err) {
      setError((err as Error).message);
      resetCheck();
    } finally {
      setBusy(false);
    }
  }

  const Tab = ({ m, label }: { m: Mode; label: string }) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-lg py-1.5 text-sm ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={submit} className="w-[22rem] rounded-2xl bg-white/95 p-6 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold">
          English Street{' '}
          {betaGate && (
            <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-purple-700">
              BETA
            </span>
          )}
        </h1>
        <p className="mb-4 text-sm text-gray-600">{t('Walk the street. Talk in English.')}</p>
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <label htmlFor="auth-lang" className="shrink-0">
            {t('My language')}
          </label>
          <LanguagePicker id="auth-lang" className="min-w-0 flex-1" />
        </div>

        {loggedIn && profile ? (
          <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {t('Signed in as {name}')
              .split('{name}')
              .map((part, i) =>
                i === 0 ? (
                  part
                ) : (
                  <span key={i}>
                    <b>{profile.name}</b>
                    {part}
                  </span>
                ),
              )}{' '}
            · {t('Level {level}', { level: profile.level })} · {profile.cefrLevel}
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
            {mode !== 'login' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Your name')}
                maxLength={20}
                autoFocus
                className="mb-2 w-full rounded-lg border px-3 py-2"
              />
            )}
            {mode !== 'guest' && (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('Email')}
                  autoComplete="email"
                  className="mb-2 w-full rounded-lg border px-3 py-2"
                />
                <div className="relative mb-2">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('Password (6+ characters)')}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full rounded-lg border py-2 pe-11 ps-3"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? t('Hide password') : t('Show password')}
                    title={showPw ? t('Hide password') : t('Show password')}
                    aria-pressed={showPw}
                    className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-800"
                  >
                    <EyeIcon open={!showPw} />
                  </button>
                </div>
              </>
            )}
            {needCaptcha && (
              <>
                {useTs ? (
                  <Turnstile
                    siteKey={siteKey}
                    resetKey={tsReset}
                    onToken={setTsToken}
                    onFail={() => setTsFailed(true)}
                  />
                ) : null}
                {!useTs && (
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="flex h-[60px] w-[170px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50"
                      aria-label={t('Security code image')}
                    >
                      {cap ? (
                        <img
                          src={`data:image/svg+xml;utf8,${encodeURIComponent(cap.svg)}`}
                          alt={t('Security code image')}
                          width={170}
                          height={60}
                          draggable={false}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">…</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void newCaptcha()}
                      title={t('New code')}
                      aria-label={t('New code')}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg hover:bg-gray-50"
                    >
                      ↻
                    </button>
                  </div>
                )}
                {!useTs && (
                  <input
                    value={capAnswer}
                    onChange={(e) => setCapAnswer(e.target.value.toUpperCase())}
                    placeholder={t('Type the code above')}
                    maxLength={8}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="mb-2 w-full rounded-lg border px-3 py-2 font-mono tracking-widest"
                  />
                )}
              </>
            )}
            {mode === 'guest' && (
              <p className="mb-2 text-xs text-gray-500">
                {t('Guest progress stays in this browser. Sign up later to keep it.')}
              </p>
            )}
          </>
        )}
        {needCode && (
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder={t('Invite code (closed beta)')}
            maxLength={64}
            autoComplete="off"
            className="mb-2 w-full rounded-lg border border-purple-300 bg-purple-50 px-3 py-2"
          />
        )}

        <button
          type="submit"
          onClick={() => setIntent('play')}
          disabled={connecting || busy}
          className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50"
        >
          {connecting
            ? t('Connecting…')
            : busy
              ? t('Please wait…')
              : mode === 'register' && !loggedIn
                ? t('Create account & play')
                : t('Enter the street')}
        </button>
        {onZones && (
          <button
            type="submit"
            onClick={() => setIntent('zones')}
            disabled={connecting || busy}
            className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
          >
            {t('Choose or create a zone…')}
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {connError && !error && (
          <p className="mt-2 text-sm text-red-600">
            {gateRefused
              ? t('English Street is in closed beta — please enter your invite code.')
              : t('Cannot reach the game server. Is it running?')}
          </p>
        )}
      </form>
    </div>
  );
}

/** Eye (show password) / crossed eye (hide it). */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}
