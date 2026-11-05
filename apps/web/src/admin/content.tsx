import { useEffect, useState, type ReactNode } from 'react';
import { API_URL, ApiError, api, get, useSession } from './api';
import { fmtDate, useL } from './i18n';
import { AsyncBtn, Badge, Btn, Card, ErrorBox, JsonEditor, Modal, Spinner, Tabs, confirmDialog, toast, toastError, useLoad } from './ui';

export type Kind = 'npc' | 'quest' | 'pair' | 'placement' | 'area' | 'area-tr' | 'world';
export interface DocDto<T> {
  kind: Kind;
  id: string;
  base: T | null;
  override: { data: T; deleted: boolean; version: number; updatedBy: string; updatedAt: string } | null;
  data: T | null;
}

/** Load / edit / save one content document (optimistic version check, revert, delete). */
export function useDoc<T>(kind: Kind, id: string, isNew = false, blank?: () => T) {
  const s = useLoad(() => (isNew ? Promise.resolve({ kind, id, base: null, override: null, data: blank!() } as DocDto<T>) : get<DocDto<T>>(`/admin/content/${kind}/${encodeURIComponent(id)}`)), [kind, id, isNew]);
  const [draft, setDraft] = useState<T | null>(null);
  useEffect(() => {
    setDraft(s.data?.data ? structuredClone(s.data.data) : null);
  }, [s.data]);
  const dirty = !!s.data && JSON.stringify(draft) !== JSON.stringify(s.data.data);
  async function save(data: T = draft!) {
    await api('PUT', `/admin/content/${kind}/${encodeURIComponent(id)}`, { data, baseVersion: s.data?.override?.version });
    s.reload();
  }
  async function revert() {
    await api('POST', `/admin/content/${kind}/${encodeURIComponent(id)}/revert`, {});
    s.reload();
  }
  async function remove() {
    await api('DELETE', `/admin/content/${kind}/${encodeURIComponent(id)}`);
  }
  return { s, draft, setDraft, dirty, save, revert, remove };
}

/** Warn before leaving the page with unsaved changes. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);
}

/** Header badges: where the document comes from. */
export function OriginBadges<T>({ d }: { d: DocDto<T> }) {
  const L = useL();
  return (
    <span className="inline-flex flex-wrap gap-1">
      {!d.base ? <Badge tone="violet">{L('tạo trong admin', 'made in admin')}</Badge> : d.override ? <Badge tone="amber">{L('đã sửa so với bản gốc', 'edited (differs from YAML)')}</Badge> : <Badge>{L('bản gốc YAML', 'YAML original')}</Badge>}
      {d.override?.deleted ? <Badge tone="red">{L('đã ẩn', 'hidden')}</Badge> : null}
      {d.override ? (
        <span className="text-xs text-gray-500">
          v{d.override.version} · {d.override.updatedBy} · {fmtDate(d.override.updatedAt)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Editor frame: Form / JSON / History tabs, a sticky save bar and the revert / YAML / delete actions.
 */
export function EditorShell<T>({
  doc,
  form,
  extraTabs = [],
  canDelete = false,
  onDeleted,
  title,
}: {
  doc: ReturnType<typeof useDoc<T>>;
  form: (d: T, set: (d: T) => void) => ReactNode;
  extraTabs?: { id: string; label: ReactNode; render: () => ReactNode }[];
  canDelete?: boolean;
  onDeleted?: () => void;
  title?: ReactNode;
}) {
  const L = useL();
  const [tab, setTab] = useState('form');
  const [yaml, setYaml] = useState<string | null>(null);
  useUnsavedGuard(doc.dirty);
  if (doc.s.error) return <ErrorBox error={doc.s.error} retry={doc.s.reload} />;
  if (!doc.s.data || !doc.draft) return <Spinner />;
  const d = doc.s.data;
  const isNew = !d.base && !d.override;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          {title}
          <OriginBadges d={d} />
        </div>
        <div className="flex flex-wrap gap-2">
          {d.override && d.base ? (
            <AsyncBtn
              onRun={async () => {
                if (!(await confirmDialog(L('Bỏ mọi thay đổi và quay về bản gốc YAML?', 'Drop every change and go back to the YAML original?')))) return;
                await doc.revert();
                toast(L('Đã khôi phục bản gốc', 'Back to the original'));
              }}
            >
              ↺ {L('Khôi phục bản gốc', 'Revert to original')}
            </AsyncBtn>
          ) : null}
          {!isNew ? (
            <AsyncBtn
              onRun={async () => {
                const t = await fetch(`${API_URL}/admin/content/${d.kind}/${encodeURIComponent(d.id)}/yaml`, { headers: { authorization: `Bearer ${useSession.getState().token}` } }).then((r) => r.text());
                setYaml(t);
              }}
            >
              {'</>'} YAML
            </AsyncBtn>
          ) : null}
          {canDelete && !isNew && !d.override?.deleted ? (
            <AsyncBtn
              kind="danger"
              onRun={async () => {
                if (!(await confirmDialog(d.base ? L('Ẩn mục này khỏi game? (Có thể khôi phục lại.)', 'Hide this from the game? (You can restore it.)') : L('Xoá hẳn mục này?', 'Delete this for good?'), { danger: true }))) return;
                try {
                  await doc.remove();
                  toast(L('Đã xoá', 'Deleted'));
                  onDeleted?.();
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              🗑 {d.base ? L('Ẩn', 'Hide') : L('Xoá', 'Delete')}
            </AsyncBtn>
          ) : null}
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[{ id: 'form', label: L('Nội dung', 'Content') }, ...extraTabs.map((t) => ({ id: t.id, label: t.label })), { id: 'json', label: 'JSON' }, ...(isNew ? [] : [{ id: 'history', label: L('Lịch sử', 'History') }])]}
      />
      {tab === 'form' ? form(doc.draft, (x) => doc.setDraft(x)) : null}
      {tab === 'json' ? (
        <Card>
          <p className="mb-2 text-xs text-gray-600">{L('Sửa trực tiếp dữ liệu (cho người rành). Bấm ra ngoài ô để áp dụng, rồi Lưu.', 'Edit the raw data (advanced). Click outside to apply, then Save.')}</p>
          <JsonEditor value={doc.draft} onChange={(v) => doc.setDraft(v as T)} rows={28} />
        </Card>
      ) : null}
      {tab === 'history' ? <History kind={d.kind} id={d.id} onRestore={async (data) => (await doc.save(data as T), toast(L('Đã khôi phục phiên bản', 'Version restored')))} /> : null}
      {extraTabs.find((t) => t.id === tab)?.render()}
      <div className={`sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-end gap-2 border-t border-gray-200 bg-white/95 px-4 py-3 md:-mx-6 md:px-6 ${doc.dirty || isNew ? '' : 'hidden'}`}>
        <span className="mr-auto text-sm text-amber-800">● {L('Có thay đổi chưa lưu', 'Unsaved changes')}</span>
        {!isNew ? <Btn onClick={() => doc.setDraft(structuredClone(d.data!))}>{L('Huỷ thay đổi', 'Discard')}</Btn> : null}
        <AsyncBtn kind="primary" okText={L('Đã lưu — game dùng bản mới ngay', 'Saved — the game uses it now')} onRun={() => doc.save()}>
          💾 {L('Lưu', 'Save')}
        </AsyncBtn>
      </div>
      {yaml !== null ? (
        <Modal title="YAML" onClose={() => setYaml(null)} wide>
          <p className="mb-2 text-xs text-gray-600">{L('Dán vào packages/quests/content để đưa thay đổi vào git.', 'Paste into packages/quests/content to bring the change into git.')}</p>
          <textarea readOnly rows={24} value={yaml} className="w-full rounded border p-2 font-mono text-xs" />
          <div className="mt-2 flex justify-end">
            <Btn onClick={() => void navigator.clipboard.writeText(yaml).then(() => toast(L('Đã chép', 'Copied')))}>📋 {L('Chép', 'Copy')}</Btn>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function History({ kind, id, onRestore }: { kind: Kind; id: string; onRestore: (data: unknown) => Promise<void> }) {
  const L = useL();
  const s = useLoad(() => get<{ id: string; version: number; data: unknown; deleted: boolean; updatedBy: string; createdAt: string }[]>(`/admin/content/${kind}/${encodeURIComponent(id)}/revisions`), [kind, id]);
  const [view, setView] = useState<unknown>(null);
  if (s.error) return <ErrorBox error={s.error} />;
  if (!s.data) return <Spinner />;
  return (
    <Card>
      {!s.data.length ? <p className="text-sm text-gray-500">{L('Chưa có thay đổi nào — đây là bản gốc.', 'No changes yet — this is the original.')}</p> : null}
      <ul className="text-sm">
        {s.data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2">
            <b>v{r.version}</b> <span className="text-gray-600">{fmtDate(r.createdAt)}</span> · {r.updatedBy} {r.deleted ? <Badge tone="red">{L('ẩn/xoá', 'hidden/deleted')}</Badge> : null}
            {r.data ? (
              <span className="ml-auto flex gap-2">
                <Btn small onClick={() => setView(r.data)}>
                  {L('Xem', 'View')}
                </Btn>
                <AsyncBtn small onRun={async () => (await confirmDialog(L(`Khôi phục phiên bản v${r.version}?`, `Restore version v${r.version}?`))) && onRestore(r.data)}>
                  ↺ {L('Khôi phục', 'Restore')}
                </AsyncBtn>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {view ? (
        <Modal title={L('Phiên bản', 'Version')} onClose={() => setView(null)} wide>
          <pre className="max-h-[70vh] overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(view, null, 2)}</pre>
        </Modal>
      ) : null}
    </Card>
  );
}

/** Small "+ / ×" list editor for arrays of objects. */
export function ListEditor<T>({ items, onChange, render, blank, addLabel, reorder = true }: { items: T[]; onChange: (v: T[]) => void; render: (it: T, set: (it: T) => void, i: number) => ReactNode; blank: () => T; addLabel: ReactNode; reorder?: boolean }) {
  const L = useL();
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j]!, n[i]!];
    onChange(n);
  };
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} className="mb-2 flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-2">
          <div className="min-w-0 flex-1">{render(it, (x) => onChange(items.map((y, k) => (k === i ? x : y))), i)}</div>
          <div className="flex shrink-0 flex-col gap-1">
            {reorder ? (
              <>
                <Btn small kind="ghost" onClick={() => move(i, -1)} aria-label={L('Lên', 'Up')} disabled={i === 0}>
                  ↑
                </Btn>
                <Btn small kind="ghost" onClick={() => move(i, 1)} aria-label={L('Xuống', 'Down')} disabled={i === items.length - 1}>
                  ↓
                </Btn>
              </>
            ) : null}
            <Btn small kind="danger" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={L('Xoá', 'Remove')}>
              ×
            </Btn>
          </div>
        </div>
      ))}
      <Btn small onClick={() => onChange([...items, blank()])}>
        + {addLabel}
      </Btn>
    </div>
  );
}

export const isConflict = (e: unknown) => e instanceof ApiError && e.status === 409;
