import { useT } from '../i18n';
import { useWorld } from '../store/world';

/** Announcements from the admin site (dismissable) and live notices from the moderators. */
export function Notices() {
  const t = useT();
  const cfg = useWorld((s) => s.cfg);
  const live = useWorld((s) => s.live);
  const dismissed = useWorld((s) => s.dismissed);
  const dismiss = useWorld((s) => s.dismiss);
  const list = [...(cfg?.announcements ?? []).filter((a) => !dismissed.includes(a.id)), ...live];
  if (!list.length) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-40 flex flex-col items-center gap-2 px-3">
      {list.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`pointer-events-auto flex max-w-xl items-start gap-2 rounded-xl px-4 py-2 text-sm shadow-lg ${n.level === 'warning' ? 'bg-amber-100 text-amber-950' : 'bg-white/95 text-gray-900'}`}
        >
          <span aria-hidden>{n.level === 'warning' ? '⚠️' : '📣'}</span>
          <span className="flex-1" dir="auto">
            {n.text}
          </span>
          <button type="button" onClick={() => dismiss(n.id)} className="ml-2 rounded px-1 text-lg leading-none text-gray-500" aria-label={t('Close')}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** Full-screen message while the admin site has maintenance on. */
export function Maintenance({ text, onContinue }: { text: string; onContinue?: () => void }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-sky-100 p-6 text-center">
      <div className="text-5xl">🛠️</div>
      <h1 className="text-xl font-bold">{t('English Street is under maintenance')}</h1>
      <p className="max-w-md text-gray-700" dir="auto">
        {text}
      </p>
      <p className="text-sm text-gray-600">{t('Please come back a little later. Thank you!')}</p>
      {onContinue ? (
        <button type="button" onClick={onContinue} className="mt-2 text-xs text-blue-700 underline">
          {t('Continue (staff)')}
        </button>
      ) : null}
    </div>
  );
}
