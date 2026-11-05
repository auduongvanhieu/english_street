import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, API_URL, api, useSession, type Me } from './api';
import { useL } from './i18n';
import { Btn, Field, Text } from './ui';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    const t = setTimeout(() => reject(new Error('timeout')), 10_000);
    s.onload = () => (clearTimeout(t), window.turnstile ? resolve(window.turnstile) : reject(new Error('missing')));
    s.onerror = () => (clearTimeout(t), reject(new Error('blocked')));
    document.head.appendChild(s);
  });
}

/** Admin sign-in: e-mail + password + Turnstile (or the image captcha when Turnstile can't load). */
export function Login() {
  const L = useL();
  const setSession = useSession((s) => s.set);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [tsFailed, setTsFailed] = useState(false);
  const [tsToken, setTsToken] = useState('');
  const [cap, setCap] = useState<{ id: string; svg: string } | null>(null);
  const [capAnswer, setCapAnswer] = useState('');
  /** Second step: one-time code from the authenticator app (the ticket proves the first step passed). */
  const [ticket, setTicket] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const useTs = !!siteKey && !tsFailed;

  useEffect(() => {
    fetch(`${API_URL}/admin/config`)
      .then((r) => r.json())
      .then((c: { turnstileSiteKey: string }) => setSiteKey(c.turnstileSiteKey || ''))
      .catch(() => setSiteKey(''));
  }, []);
  const newCaptcha = () =>
    fetch(`${API_URL}/auth/captcha`)
      .then((r) => r.json())
      .then((c: { id: string; svg: string }) => (setCap(c), setCapAnswer('')))
      .catch(() => undefined);
  useEffect(() => {
    if (siteKey === null) return;
    if (!useTs) {
      void newCaptcha();
      return;
    }
    let alive = true;
    loadTurnstile()
      .then((ts) => {
        if (!alive || !box.current) return;
        widget.current = ts.render(box.current, { sitekey: siteKey, theme: 'light', size: 'flexible', callback: setTsToken, 'expired-callback': () => setTsToken(''), 'error-callback': () => (setTsFailed(true), true) });
      })
      .catch(() => alive && setTsFailed(true));
    return () => {
      alive = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, useTs]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const check = ticket ? { ticket, otp: otp.trim() } : useTs ? (tsToken ? { turnstileToken: tsToken } : null) : cap && capAnswer.trim() ? { captchaId: cap.id, captchaAnswer: capAnswer.trim() } : null;
    if (!check) return setError(L('Hãy hoàn thành bước kiểm tra bảo mật.', 'Please complete the security check.'));
    setBusy(true);
    try {
      const r = await api<{ token: string; me: Me; expiresIn: number }>('POST', '/admin/login', { email, password, ...check });
      setSession(r.token, r.me, r.expiresIn);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'otp_required' && err instanceof ApiError) {
        setTicket(String(err.body.ticket ?? ''));
        setBusy(false);
        return;
      }
      if (code === 'otp_wrong') {
        setOtp('');
        setBusy(false);
        return setError(L('Mã xác thực không đúng.', 'Wrong code.'));
      }
      setError(
        code === 'invalid_credentials'
          ? L('Sai email/mật khẩu, hoặc tài khoản không có quyền quản trị.', 'Wrong e-mail/password, or the account has no admin access.')
          : code === 'captcha_failed'
            ? L('Mã kiểm tra sai hoặc hết hạn.', 'The security check failed or expired.')
            : code === 'rate_limited'
              ? L('Thử quá nhiều lần. Đợi vài phút.', 'Too many attempts. Wait a few minutes.')
              : code === 'db_required'
                ? L('Máy chủ chưa kết nối database.', 'The server has no database.')
                : (err as Error).message,
      );
      if (useTs && widget.current) {
        setTsToken('');
        window.turnstile?.reset(widget.current);
      } else void newCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-center">
          <div className="text-3xl">🏙️</div>
          <h1 className="text-lg font-bold">English Street — Admin</h1>
          <p className="text-xs text-gray-500">{L('Đăng nhập bằng tài khoản có quyền biên tập hoặc quản trị.', 'Sign in with an editor or admin account.')}</p>
        </div>
        <Field label="Email">
          <Text type="email" autoComplete="username" value={email} onChange={setEmail} required autoFocus />
        </Field>
        <Field label={L('Mật khẩu', 'Password')}>
          <div className="flex gap-1">
            <Text type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={setPassword} required />
            <Btn kind="ghost" onClick={() => setShow(!show)} aria-label={show ? L('Ẩn mật khẩu', 'Hide password') : L('Hiện mật khẩu', 'Show password')}>
              {show ? '🙈' : '👁'}
            </Btn>
          </div>
        </Field>
        {ticket ? (
          <Field label={L('Mã 6 số trong ứng dụng xác thực', '6-digit code from your authenticator app')}>
            <Text value={otp} onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus className="text-center font-mono text-lg tracking-[0.4em]" />
          </Field>
        ) : null}
        <div className={ticket ? 'hidden' : ''}>
        {useTs ? <div ref={box} className="mb-3 min-h-[65px]" /> : null}
        {!useTs && cap ? (
          <div className="mb-3">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-[60px] flex-1 rounded border bg-white" dangerouslySetInnerHTML={{ __html: cap.svg }} />
              <Btn kind="ghost" onClick={() => void newCaptcha()} aria-label={L('Mã khác', 'New code')}>
                ↻
              </Btn>
            </div>
            <Text value={capAnswer} onChange={setCapAnswer} placeholder={L('Nhập mã trong hình', 'Type the code')} className="font-mono tracking-widest" />
          </div>
        ) : null}
        </div>
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <Btn kind="primary" type="submit" disabled={busy} className="w-full">
          {busy ? '…' : L('Đăng nhập', 'Sign in')}
        </Btn>
      </form>
    </div>
  );
}
