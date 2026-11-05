import { useEffect, useMemo, useState } from 'react';
import { LANGS } from '@es/shared';
import { api, get } from '../api';
import { go } from '../App';
import { fmtDate, fmtNum, useL } from '../i18n';
import { AsyncBtn, Badge, Btn, Card, Loaded, Page, Select, Text, toast, useLoad } from '../ui';

interface TrDto {
  lang: string;
  source: Record<string, string>;
  tr: Record<string, string>;
  overridden: string[];
  stale: string[];
}
interface Status {
  running: boolean;
  queued: boolean;
  done: number;
  total: number;
  strings: number;
  pending: number;
  error: string;
  finishedAt: string | null;
}

/** Area content translations per language: auto-translated, fixable by hand. */
export function TranslationsPage({ lang: raw }: { lang?: string }) {
  const L = useL();
  const [langPart, query] = (raw ?? '').split('?');
  const lang = langPart || 'vi';
  const initialQ = new URLSearchParams(query ?? location.hash.split('?')[1] ?? '').get('q') ?? '';
  const [q, setQ] = useState(initialQ);
  const [only, setOnly] = useState<'all' | 'missing' | 'edited' | 'stale'>('all');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(100);
  const s = useLoad(() => get<TrDto>(`/admin/translations/${lang}`), [lang]);
  const st = useLoad(() => get<Status>('/admin/translation'));
  useEffect(() => {
    setEdits({});
  }, [lang]);
  useEffect(() => {
    if (!st.data?.running) return;
    const t = setInterval(st.reload, 4000);
    return () => clearInterval(t);
  }, [st.data?.running, st.reload]);
  const keys = useMemo(() => {
    if (!s.data) return [];
    const d = s.data;
    const over = new Set(d.overridden);
    const stale = new Set(d.stale);
    return Object.keys(d.source)
      .sort()
      .filter((k) => (only === 'missing' ? !d.tr[k] : only === 'edited' ? over.has(k) : only === 'stale' ? stale.has(k) : true))
      .filter((k) => !q || k.includes(q) || d.source[k]!.toLowerCase().includes(q.toLowerCase()) || (d.tr[k] ?? '').toLowerCase().includes(q.toLowerCase()));
  }, [s.data, q, only]);
  const dirty = Object.keys(edits).length;
  return (
    <Page
      title={`🌐 ${L('Bản dịch nội dung các khu', 'Area content translations')}`}
      actions={
        <Select
          aria-label={L('Ngôn ngữ', 'Language')} inline
          value={lang}
          onChange={(v) => go(`translations/${v}`)}
          options={LANGS.filter((l) => l.code !== 'en').map((l) => ({ value: l.code, label: `${l.native} (${l.code})` }))}
        />
      }
    >
      <Card>
        <Loaded s={st}>
          {(t) => (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {t.running ? (
                <Badge tone="blue">
                  {L('Đang dịch', 'Translating')} {t.done}/{t.total} {L('ngôn ngữ', 'languages')}
                </Badge>
              ) : (
                <Badge tone={t.pending ? 'amber' : 'green'}>
                  {fmtNum(t.pending)} {L('chuỗi chờ dịch (mọi ngôn ngữ)', 'strings waiting (all languages)')}
                </Badge>
              )}
              {t.error ? <Badge tone="red">{t.error === 'no_api_key' ? L('Chưa có ANTHROPIC_API_KEY', 'No ANTHROPIC_API_KEY') : t.error}</Badge> : null}
              {t.finishedAt ? <span className="text-xs text-gray-500">{L('Lần dịch gần nhất', 'Last run')}: {fmtDate(t.finishedAt)} ({t.strings})</span> : null}
              <AsyncBtn small disabled={t.running} onRun={async () => (await api('POST', '/admin/translation/run', {}), st.reload())}>
                ▶ {L('Dịch phần còn thiếu ngay', 'Translate what is missing now')}
              </AsyncBtn>
            </div>
          )}
        </Loaded>
      </Card>
      <Loaded s={s}>
        {(d) => (
          <Card title={`${fmtNum(keys.length)} / ${fmtNum(Object.keys(d.source).length)}`}>
            <div className="mb-3 grid gap-2 md:grid-cols-[2fr_1fr]">
              <Text value={q} onChange={setQ} placeholder={L('Tìm theo khoá, tiếng Anh hoặc bản dịch…', 'Search key, English or translation…')} aria-label={L('Tìm', 'Search')} />
              <Select
                aria-label={L('Lọc', 'Filter')}
                value={only}
                onChange={setOnly}
                options={[
                  { value: 'all', label: L('Tất cả', 'All') },
                  { value: 'missing', label: L('Chưa dịch', 'Missing') },
                  { value: 'stale', label: L('Tiếng Anh đã đổi', 'English changed') },
                  { value: 'edited', label: L('Đã sửa tay / tự dịch trong admin', 'Edited in admin') },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              {keys.slice(0, limit).map((k) => (
                <div key={k} className="grid gap-2 border-b border-gray-100 pb-2 md:grid-cols-2">
                  <div>
                    <div className="font-mono text-[11px] text-gray-500">{k}</div>
                    <div className="text-sm" dir="ltr">
                      {d.source[k]}
                    </div>
                  </div>
                  <div className="flex items-start gap-1">
                    <textarea
                      rows={Math.min(4, Math.ceil(((edits[k] ?? d.tr[k] ?? '').length + 1) / 60))}
                      value={edits[k] ?? d.tr[k] ?? ''}
                      onChange={(e) => setEdits({ ...edits, [k]: e.target.value })}
                      placeholder={L('(chưa dịch)', '(missing)')}
                      className={`w-full rounded-lg border px-2 py-1 text-sm ${edits[k] !== undefined ? 'border-amber-400 bg-amber-50' : d.tr[k] ? 'border-gray-300' : 'border-red-300'}`}
                      aria-label={k}
                    />
                    {d.stale.includes(k) ? <Badge tone="amber">{L('cũ', 'stale')}</Badge> : null}
                  </div>
                </div>
              ))}
              {keys.length > limit ? (
                <Btn onClick={() => setLimit(limit + 100)}>
                  {L('Xem thêm', 'Show more')} ({fmtNum(keys.length - limit)})
                </Btn>
              ) : null}
            </div>
            <div className={`sticky bottom-0 mt-3 flex items-center justify-end gap-2 border-t bg-white py-3 ${dirty ? '' : 'hidden'}`}>
              <span className="mr-auto text-sm text-amber-800">● {dirty} {L('bản dịch đã sửa', 'edited')}</span>
              <Btn onClick={() => setEdits({})}>{L('Huỷ', 'Discard')}</Btn>
              <AsyncBtn
                kind="primary"
                onRun={async () => {
                  const cur = await get<{ override: { data: Record<string, string>; version: number } | null }>(`/admin/content/area-tr/${lang}`);
                  const data = { ...(cur.override?.data ?? {}), ...Object.fromEntries(Object.entries(edits).filter(([, v]) => v.trim())) };
                  await api('PUT', `/admin/content/area-tr/${lang}`, { data, baseVersion: cur.override?.version });
                  toast(L('Đã lưu bản dịch', 'Translations saved'));
                  setEdits({});
                  s.reload();
                }}
              >
                💾 {L('Lưu', 'Save')}
              </AsyncBtn>
            </div>
          </Card>
        )}
      </Loaded>
    </Page>
  );
}
