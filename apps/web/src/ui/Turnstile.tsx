import { useEffect, useRef } from 'react';
import { useLang } from '../i18n';

/** Cloudflare Turnstile (https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/). */
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

let script: Promise<TurnstileApi> | null = null;
/** Load the Turnstile script once; rejects when it cannot load (blocked network) within 10 s. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    const timer = setTimeout(() => reject(new Error('turnstile timeout')), 10_000);
    s.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile missing'));
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error('turnstile blocked'));
    };
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    script = null; // allow a retry later
    throw e;
  });
  return script;
}

/**
 * The Turnstile widget. `onToken('')` when the token expires; `onFail()` when Turnstile cannot run here
 * (the form then falls back to the built-in image captcha). Bump `resetKey` after a failed submit:
 * every token can be checked once.
 */
export function Turnstile({
  siteKey,
  resetKey,
  onToken,
  onFail,
}: {
  siteKey: string;
  resetKey: number;
  onToken: (token: string) => void;
  onFail: () => void;
}) {
  // widget text in the interface language (Turnstile knows all of ours; 'en' for English)
  const lang = useLang((s) => s.uiLang).toLowerCase();
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef({ onToken, onFail });
  cb.current = { onToken, onFail };

  useEffect(() => {
    let alive = true;
    loadTurnstile()
      .then((ts) => {
        if (!alive || !box.current) return;
        id.current = ts.render(box.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'flexible',
          language: lang,
          callback: (token: string) => cb.current.onToken(token),
          'expired-callback': () => cb.current.onToken(''),
          'timeout-callback': () => cb.current.onToken(''),
          'error-callback': () => {
            cb.current.onFail();
            return true;
          },
        });
      })
      .catch(() => alive && cb.current.onFail());
    return () => {
      alive = false;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [siteKey, lang]);

  useEffect(() => {
    if (resetKey && id.current) {
      cb.current.onToken('');
      window.turnstile?.reset(id.current);
    }
  }, [resetKey]);

  return <div ref={box} className="mb-2 min-h-[65px]" />;
}
