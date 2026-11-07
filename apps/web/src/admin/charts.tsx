import { useMemo, useRef, useState, type ReactNode } from 'react';
import { fmtNum, useL } from './i18n';

/**
 * Small chart kit for the admin pages (dataviz reference palette, light surface):
 * one series = blue #2a78d6, sequential = blue ramp, text in ink tokens, recessive axes, hover tooltips,
 * and a table view next to every chart.
 */
export const C = {
  surface: '#ffffff',
  ink: '#0b0b0b',
  ink2: '#52514e',
  grid: '#e7e6e2',
  series: '#2a78d6',
  /** blue ramp 100 → 700 (sequential) */
  ramp: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'],
};

export function StatTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 text-[28px] leading-none font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {sub ? <div className="mt-1.5 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

/** Chart + "table" toggle (every chart has a table view). */
export function ChartCard({ title, children, table, note }: { title: ReactNode; children: ReactNode; table: { head: string[]; rows: (string | number)[][] }; note?: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  const L = useL();
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 md:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#0b0b0b]">{title}</h2>
        <button type="button" className="text-xs text-blue-700 underline" onClick={() => setAsTable(!asTable)}>
          {asTable ? L('Xem biểu đồ', 'Show chart') : L('Xem bảng', 'Show table')}
        </button>
      </div>
      {note ? <p className="mb-2 text-xs text-[#52514e]">{note}</p> : null}
      {asTable ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[#52514e]">
                {table.head.map((h) => (
                  <th key={h} className="px-2 py-1">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {r.map((c, j) => (
                    <td key={j} className={`px-2 py-1 ${typeof c === 'number' ? 'text-right tabular-nums' : ''}`}>
                      {typeof c === 'number' ? fmtNum(c, 2) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Ranked horizontal bars (one series): label left, value right in ink, bar in between. */
export function BarList({ rows, format = (n) => fmtNum(n), max: maxRows = 12 }: { rows: { label: ReactNode; key: string; value: number; sub?: string }[]; format?: (n: number) => string; max?: number }) {
  const L = useL();
  const shown = rows.slice(0, maxRows);
  const max = Math.max(1, ...shown.map((r) => r.value));
  if (!shown.length) return <p className="py-3 text-center text-xs text-[#52514e]">{L('Chưa có dữ liệu trong khoảng này.', 'No data in this range yet.')}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {shown.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-2 text-xs" title={`${r.sub ?? ''} ${format(r.value)}`}>
          <span className="truncate text-[#0b0b0b]">{r.label}</span>
          <span className="h-3 rounded-r-[4px] bg-[#e7e6e2]/40">
            <span className="block h-3 rounded-r-[4px]" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: C.series }} />
          </span>
          <span className="text-right text-[#52514e] tabular-nums">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Daily series as columns (one series) with a hover tooltip; x labels thinned out. */
export function DailyColumns({ days, values, format = (n) => fmtNum(n), height = 160 }: { days: string[]; values: number[]; format?: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const W = 640;
  const H = height;
  const pad = { l: 36, r: 8, t: 8, b: 20 };
  const max = Math.max(1, ...values);
  const nice = niceMax(max);
  const bw = (W - pad.l - pad.r) / Math.max(1, days.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  const every = Math.ceil(days.length / 8);
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} stroke={C.grid} strokeWidth={1} />
            <text x={pad.l - 4} y={y(nice * f) + 3} textAnchor="end" fontSize={10} fill={C.ink2}>
              {format(nice * f)}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = pad.l + i * bw;
          const top = y(v);
          const h = H - pad.b - top;
          const w = Math.max(1, bw - 2); // 2px surface gap between bars
          const r = Math.min(4, w / 2, h);
          return (
            <g key={days[i]} onMouseEnter={() => setHover(i)}>
              {/* hit target: the full column height */}
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {v > 0 ? <path d={roundedTop(x + 1, top, w, h, r)} fill={C.series} opacity={hover === null || hover === i ? 1 : 0.55} /> : null}
              {i % every === 0 ? (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={C.ink2}>
                  {days[i]!.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={C.ink2} strokeWidth={1} />
      </svg>
      {hover !== null ? (
        <div className="pointer-events-none absolute top-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs shadow" style={{ left: `${Math.min(80, ((pad.l + hover * bw) / W) * 100)}%` }}>
          <div className="text-[#52514e]">{days[hover]}</div>
          <div className="font-semibold text-[#0b0b0b] tabular-nums">{format(values[hover]!)}</div>
        </div>
      ) : null}
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}
function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export interface MapShape {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  label?: string;
  kind: 'area' | 'shop' | 'street';
}
/**
 * Top-down street map with a heat layer (cells of `cell` metres, sequential blue by sample count, log scale)
 * and the areas / shops outlined. Hover a cell for its count.
 */
export function HeatMap({ cells, cell, shapes, bounds }: { cells: [number, number, number][]; cell: number; shapes: MapShape[]; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } }) {
  const [hover, setHover] = useState<{ x: number; z: number; n: number; px: number; py: number } | null>(null);
  const L = useL();
  // 7 px per metre: the street is long and narrow, so the map scrolls sideways instead of shrinking
  const sx = 7;
  const W = Math.round((bounds.maxX - bounds.minX) * sx);
  const H = Math.round((bounds.maxZ - bounds.minZ) * sx);
  const X = (x: number) => (x - bounds.minX) * sx;
  const Z = (z: number) => (z - bounds.minZ) * sx;
  const max = Math.max(1, ...cells.map((c) => c[2]));
  const shade = useMemo(() => (n: number) => C.ramp[Math.min(C.ramp.length - 1, Math.floor((Math.log(1 + n) / Math.log(1 + max)) * (C.ramp.length - 1)))]!, [max]);
  return (
    <div className="relative">
      <div
        className="overflow-x-auto rounded-lg border border-gray-200"
        ref={(el) => {
          // start on Main Street (x = 0) rather than at the restaurant end
          if (el && !el.dataset.centered) {
            el.dataset.centered = '1';
            el.scrollLeft = (X(0) - el.clientWidth / 2) | 0;
          }
        }}
      >
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block bg-[#f5f5f1]" onMouseLeave={() => setHover(null)}>
        {shapes
          .filter((s) => s.kind !== 'shop')
          .map((s, i) => (
            <rect key={`s${i}`} x={X(s.x0)} y={Z(s.z0)} width={X(s.x1) - X(s.x0)} height={Z(s.z1) - Z(s.z0)} fill={s.kind === 'street' ? '#ecebe6' : '#ffffff'} stroke="#c9c8c1" strokeWidth={1} />
          ))}
        {cells.map(([cx, cz, n]) => (
          <rect
            key={`${cx}:${cz}`}
            x={X(cx * cell)}
            y={Z(cz * cell)}
            width={cell * sx}
            height={cell * sx}
            fill={shade(n)}
            stroke={C.surface}
            strokeWidth={0.5}
            onMouseEnter={(e) => {
              const r = (e.currentTarget.ownerSVGElement!.parentElement!.parentElement as HTMLElement).getBoundingClientRect();
              setHover({ x: cx * cell, z: cz * cell, n, px: e.clientX - r.left, py: e.clientY - r.top });
            }}
          />
        ))}
        {shapes
          .filter((s) => s.kind === 'shop')
          .map((s, i) => (
            <rect key={`p${i}`} x={X(s.x0)} y={Z(s.z0)} width={X(s.x1) - X(s.x0)} height={Z(s.z1) - Z(s.z0)} fill="none" stroke="#8a8980" strokeWidth={1} strokeDasharray="3 2" />
          ))}
        {shapes
          .filter((s) => s.label)
          .map((s, i) => (
            <text key={`l${i}`} x={(X(s.x0) + X(s.x1)) / 2} y={s.kind === 'shop' ? Z(s.z0) + 12 : Z(s.z0) + 16} textAnchor="middle" fontSize={s.kind === 'shop' ? 10 : 14} fill={C.ink} fontWeight={s.kind === 'area' ? 600 : 400}>
              {s.label}
            </text>
          ))}
      </svg>
      </div>
      {hover ? (
        <div className="pointer-events-none absolute rounded-md border border-gray-200 bg-white px-2 py-1 text-xs shadow" style={{ left: hover.px + 12, top: hover.py + 12 }}>
          x {hover.x}…{hover.x + cell}, z {hover.z}…{hover.z + cell} m<br />
          <b className="tabular-nums">{fmtNum(hover.n)}</b> {L('lượt ghi nhận', 'samples')}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2 text-xs text-[#52514e]">
        <span>{L('Ít', 'Few')}</span>
        <span className="flex h-3 w-40 overflow-hidden rounded">
          {C.ramp.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </span>
        <span>
          {L('Nhiều', 'Many')} ({fmtNum(max)})
        </span>
      </div>
    </div>
  );
}
