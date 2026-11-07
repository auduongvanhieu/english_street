import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { ApiError } from './api';
import { useL } from './i18n';

// ---------------------------------------------------------------- toasts
interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}
export const useToasts = create<{ list: Toast[]; push: (text: string, kind?: Toast['kind']) => void }>((set, get) => ({
  list: [],
  push(text, kind = 'ok') {
    const id = Date.now() + Math.random();
    set({ list: [...get().list, { id, text, kind }] });
    setTimeout(() => set({ list: get().list.filter((t) => t.id !== id) }), kind === 'error' ? 8000 : 3000);
  },
}));
export const toast = (text: string, kind: Toast['kind'] = 'ok') => useToasts.getState().push(text, kind);
export const toastError = (e: unknown) => toast(e instanceof ApiError ? e.detail : (e as Error).message, 'error');

export function Toasts() {
  const list = useToasts((s) => s.list);
  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`rounded-xl px-4 py-2.5 text-sm whitespace-pre-line shadow-xl ring-1 ${t.kind === 'ok' ? 'bg-slate-900 text-white ring-emerald-400/40' : 'bg-red-600 text-white ring-red-300/40'}`}>
          {t.kind === 'ok' ? '✓ ' : '⚠ '}
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- data loading
/** Load on mount and when deps change; `reload()` refetches. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(() => {
    const my = ++seq.current;
    setLoading(true);
    fn()
      .then((d) => my === seq.current && (setData(d), setError(null)))
      .catch((e: unknown) => my === seq.current && setError(e instanceof ApiError ? e.detail : (e as Error).message))
      .finally(() => my === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { data, error, loading, reload: run, setData };
}

// ---------------------------------------------------------------- building blocks
export function Page({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}
export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 md:p-5 ${className}`}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2> : <span />}
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

type BtnKind = 'primary' | 'default' | 'danger' | 'ghost';
const BTN: Record<BtnKind, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600 shadow-sm shadow-indigo-200',
  default: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-sm',
  danger: 'bg-white text-red-600 hover:bg-red-50 border-red-200',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
};
export function Btn({ kind = 'default', small, className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; small?: boolean }) {
  return <button type="button" {...p} className={`rounded-lg border font-medium transition-colors disabled:opacity-50 ${small ? 'px-2 py-1 text-xs' : 'min-h-9 px-3.5 py-1.5 text-sm'} ${BTN[kind]} ${className}`} />;
}

/** Button that runs an async action, shows a spinner and reports errors. */
export function AsyncBtn({ onRun, okText, children, ...p }: Omit<React.ComponentProps<typeof Btn>, 'onClick'> & { onRun: () => Promise<unknown>; okText?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      {...p}
      disabled={busy || p.disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await onRun();
          if (okText) toast(okText);
        } catch (e) {
          toastError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? '…' : children}
    </Btn>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' }) {
  const c = { gray: 'bg-slate-100 text-slate-600 ring-slate-200', blue: 'bg-sky-50 text-sky-700 ring-sky-200', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', red: 'bg-red-50 text-red-700 ring-red-200', violet: 'bg-violet-50 text-violet-700 ring-violet-200' }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${c}`}>{children}</span>;
}

export function Spinner() {
  const L = useL();
  return <div className="p-6 text-center text-sm text-gray-500">{L('Đang tải…', 'Loading…')}</div>;
}
export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  const L = useL();
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm whitespace-pre-line text-red-800">
      ⚠ {error} {retry ? <Btn small onClick={retry} className="ml-2">{L('Thử lại', 'Retry')}</Btn> : null}
    </div>
  );
}
export function Loaded<T>({ s, children }: { s: { data: T | null; error: string | null; loading: boolean; reload: () => void }; children: (d: T) => ReactNode }) {
  if (s.error) return <ErrorBox error={s.error} retry={s.reload} />;
  if (!s.data) return <Spinner />;
  return <>{children(s.data)}</>;
}

// ---------------------------------------------------------------- form fields
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none';
export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`mb-3 block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-gray-700">{label}</span>
      {children}
      {hint ? <span className="mt-0.5 block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}
export function Text({ value, onChange, ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string | undefined; onChange: (v: string) => void }) {
  return <input {...p} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${p.className ?? ''}`} />;
}
export function Num({ value, onChange, ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: number | undefined | null; onChange: (v: number | undefined) => void }) {
  return <input type="number" {...p} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} className={`${inputCls} ${p.className ?? ''}`} />;
}
export function Area({ value, onChange, rows = 4, ...p }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & { value: string | undefined; onChange: (v: string) => void }) {
  return <textarea {...p} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} font-[inherit] ${p.className ?? ''}`} />;
}
export function Select<T extends string>({ value, onChange, options, ...p }: { value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[]; className?: string; 'aria-label'?: string; inline?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`${inputCls.replace('w-full', p.inline ? 'w-auto' : 'w-full')} ${p.className ?? ''}`} aria-label={p['aria-label']}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        return (
          <option key={v} value={v}>
            {typeof o === 'string' ? o : o.label}
          </option>
        );
      })}
    </select>
  );
}
export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
/** Comma-separated list ↔ string[]. */
export function ListInput({ value, onChange, placeholder }: { value: string[] | undefined; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState((value ?? []).join(', '));
  useEffect(() => {
    setText((value ?? []).join(", "));
  }, [value]);
  return (
    <input
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(
          text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
      className={inputCls}
    />
  );
}

// ---------------------------------------------------------------- modal / confirm
export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal className={`mt-10 w-full rounded-xl bg-white p-5 shadow-xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmState {
  text: string;
  danger?: boolean;
  /** Ask the user to type this to confirm (deletes). */
  typeToConfirm?: string;
  resolve: (ok: boolean) => void;
}
const useConfirm = create<{ c: ConfirmState | null; set: (c: ConfirmState | null) => void }>((set) => ({ c: null, set: (c) => set({ c }) }));
/** await confirm('Delete?') */
export const confirmDialog = (text: string, opts: { danger?: boolean; typeToConfirm?: string } = {}) => new Promise<boolean>((resolve) => useConfirm.getState().set({ text, ...opts, resolve }));
export function ConfirmHost() {
  const c = useConfirm((s) => s.c);
  const set = useConfirm((s) => s.set);
  const [typed, setTyped] = useState('');
  const L = useL();
  if (!c) return null;
  const close = (ok: boolean) => {
    c.resolve(ok);
    set(null);
    setTyped('');
  };
  return (
    <Modal title={L('Xác nhận', 'Confirm')} onClose={() => close(false)}>
      <p className="mb-3 text-sm whitespace-pre-line">{c.text}</p>
      {c.typeToConfirm ? (
        <Field label={L(`Gõ "${c.typeToConfirm}" để xác nhận`, `Type "${c.typeToConfirm}" to confirm`)}>
          <Text value={typed} onChange={setTyped} autoFocus />
        </Field>
      ) : null}
      <div className="flex justify-end gap-2">
        <Btn onClick={() => close(false)}>{L('Huỷ', 'Cancel')}</Btn>
        <Btn kind={c.danger ? 'danger' : 'primary'} disabled={!!c.typeToConfirm && typed !== c.typeToConfirm} onClick={() => close(true)} autoFocus={!c.typeToConfirm}>
          {L('Đồng ý', 'OK')}
        </Btn>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- table
export interface Col<T> {
  key: string;
  label: ReactNode;
  render: (r: T) => ReactNode;
  className?: string;
  /** Hide on small screens (the row turns into a card). */
  wide?: boolean;
}
/** Table on desktop; on phones every row becomes a small card. */
const TABLE_PAGE = 25;
export function Table<T>({ rows, cols, rowKey, onRow, empty, paged = true }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; onRow?: (r: T) => void; empty?: ReactNode; /** false: the page pages itself (server pages) */ paged?: boolean }) {
  const L = useL();
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rows.length / TABLE_PAGE);
  useEffect(() => {
    if (page >= pages) setPage(0);
  }, [page, pages]);
  if (!rows.length) return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{empty ?? L('Không có dữ liệu', 'Nothing here')}</div>;
  // long lists come in pages of 25
  const shown = paged && rows.length > TABLE_PAGE + 5 ? rows.slice(page * TABLE_PAGE, (page + 1) * TABLE_PAGE) : rows;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl ring-1 ring-slate-200 md:block">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="bg-slate-50 text-[11px] tracking-wide text-slate-500 uppercase">
              {cols.map((c) => (
                <th key={c.key} className={`border-b border-slate-200 px-3 py-2.5 font-semibold ${c.className ?? ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {shown.map((r) => (
              <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className={`even:bg-slate-50/50 ${onRow ? 'cursor-pointer hover:bg-indigo-50/60' : ''}`}>
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 align-top text-slate-700 ${c.className ?? ''}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {shown.map((r) => (
          <div key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200">
            {cols
              .filter((c) => !c.wide)
              .map((c) => (
                <div key={c.key} className="flex justify-between gap-3 py-0.5">
                  <span className="text-xs text-slate-500">{c.label}</span>
                  <span className="text-right">{c.render(r)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
      {shown.length < rows.length ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {page * TABLE_PAGE + 1}–{Math.min(rows.length, (page + 1) * TABLE_PAGE)} / {rows.length}
          </span>
          <span className="flex gap-1">
            <Btn small disabled={page === 0} onClick={() => setPage(page - 1)}>
              ‹ {L('Trước', 'Prev')}
            </Btn>
            <Btn small disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              {L('Sau', 'Next')} ›
            </Btn>
          </span>
        </div>
      ) : null}
    </>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${value === t.id ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Raw JSON editor (advanced): parses on blur, reports errors. */
export function JsonEditor({ value, onChange, rows = 18 }: { value: unknown; onChange: (v: unknown) => void; rows?: number }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [err, setErr] = useState('');
  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);
  return (
    <div>
      <textarea
        rows={rows}
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            onChange(JSON.parse(text));
            setErr('');
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
        className={`${inputCls} font-mono text-xs`}
      />
      {err ? <div className="text-xs text-red-700">JSON: {err}</div> : null}
    </div>
  );
}
