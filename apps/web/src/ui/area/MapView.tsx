import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AREA_INFO, type AreaId } from '@es/shared';
import type { RemotePlayer } from '../../store/game';
import { AREAS, BRIDGE_X, BUS_STOPS, FRONT_Z, SOUTH_BACK_Z, SOUTH_END_X, SOUTH_ROAD_Z, STREET_END_X, YARD_MIN_Z, backZ, frontZ } from '../../world/areas';

/**
 * The street map drawn as an SVG whose viewBox matches its CSS size (1 unit = 1 px), so text stays readable.
 * The world is a long thin strip (x ≈ ±297, z ≈ −34…81): wide containers draw it lying down (west left,
 * north up), narrow ones (phones) turn it a quarter clockwise (west at the top, north on the right) and the
 * box scrolls vertically. Both views go through one projection, so labels are always upright.
 */

const X0 = -STREET_END_X - 4;
const X1 = STREET_END_X + 4;
const Z0 = YARD_MIN_Z - 4.5;
const Z1 = SOUTH_BACK_Z + 4;
const RIVER_Z0 = 18;
const RIVER_Z1 = 38;
/** Containers at least this wide get the lying-down map. */
const WIDE_MIN = 760;
/** Pixels per metre along the street in the upright (phone) map. */
const ALONG_PHONE = 2.1;

type Proj = { w: number; h: number; vertical: boolean; p: (x: number, z: number) => [number, number] };

function makeProj(w: number): Proj {
  if (w >= WIDE_MIN) {
    const sx = w / (X1 - X0);
    const sz = Math.max(sx, 2.4);
    return { w, h: Math.round((Z1 - Z0) * sz), vertical: false, p: (x, z) => [(x - X0) * sx, (z - Z0) * sz] };
  }
  const su = w / (Z1 - Z0);
  const sv = ALONG_PHONE;
  // quarter turn clockwise: west (−x) at the top, north (−z) on the right
  return { w, h: Math.round((X1 - X0) * sv), vertical: true, p: (x, z) => [(Z1 - z) * su, (x - X0) * sv] };
}

/** Screen rectangle of a world box. */
function box(pr: Proj, x0: number, x1: number, z0: number, z1: number) {
  const [a, b] = pr.p(x0, z0);
  const [c, d] = pr.p(x1, z1);
  return { x: Math.min(a, c), y: Math.min(b, d), width: Math.abs(c - a), height: Math.abs(d - b) };
}

const pts = (pr: Proj, list: [number, number][]) => list.map(([x, z]) => pr.p(x, z).map((n) => n.toFixed(1)).join(',')).join(' ');

/** Rough text width for the label pills (bold UI font). */
const textW = (s: string, size: number) => s.length * size * 0.6;

const C = {
  grass: '#c7e6a3',
  grassDark: '#b4da8a',
  road: '#64748b',
  roadEdge: '#475569',
  river: '#93d3f2',
  riverEdge: '#6fc0e8',
  wave: '#d6f0fb',
  plank: '#b9895a',
  plankDark: '#8a613a',
  me: '#e11d48',
  other: '#2563eb',
  focus: '#f59e0b',
  ink: '#1e293b',
};

function Pill({ cx, cy, label, icon, size = 12 }: { cx: number; cy: number; label: string; icon?: string; size?: number }) {
  const iconW = icon ? size + 5 : 0;
  const w = textW(label, size) + iconW + 14;
  const h = size + 10;
  const x = cx - w / 2;
  return (
    <g pointerEvents="none">
      <rect x={x} y={cy - h / 2} width={w} height={h} rx={h / 2} fill="#fff" fillOpacity={0.95} stroke="#0f172a" strokeOpacity={0.08} filter="url(#es-map-shadow)" />
      {icon ? (
        <text x={x + 7 + iconW / 2 - 2} y={cy + size * 0.36} fontSize={size} textAnchor="middle">
          {icon}
        </text>
      ) : null}
      <text x={x + 7 + iconW + textW(label, size) / 2} y={cy + size * 0.36} fontSize={size} fontWeight={700} textAnchor="middle" fill={C.ink}>
        {label}
      </text>
    </g>
  );
}

/** Yellow badge with a star: a journey task waits here. */
function TaskBadge({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={9} fill="#facc15" opacity={0.5}>
        <animate attributeName="r" values="9;15;9" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.55;0;0.55" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={9.5} fill="#facc15" stroke="#fff" strokeWidth={2} />
      <path d={starPath(cx, cy, 5.6, 2.5)} fill="#92400e" />
    </g>
  );
}

function starPath(cx: number, cy: number, r1: number, r2: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
}

/** Green badge with a tick: the passport stamp of this place is done. */
function StampBadge({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={9} fill="#22c55e" stroke="#fff" strokeWidth={2} />
      <path d={`M${cx - 4},${cy + 0.3} l2.8,2.8 l5.2,-5.6`} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** A short wavy stroke on the river, centred at world (x, z), running along the river. */
function wave(pr: Proj, x: number, z: number) {
  const list: [number, number][] = [];
  for (let i = 0; i <= 8; i++) list.push([x - 8 + i * 2, z + Math.sin((i / 8) * Math.PI * 2) * 0.9]);
  return pts(pr, list);
}

export interface MapViewProps {
  me: { x: number; z: number } | null;
  players: RemotePlayer[];
  focusId: string | null;
  journeyAreas: Set<string>;
  journeyStamps: string[];
  labels: { shops: string; river: string; you: string };
  onArea: (id: AreaId) => void;
  onPlayer: (id: string) => void;
  /** Rendered over the map's top-left corner (e.g. "you are away" note). */
  overlay?: ReactNode;
}

/** Is (x, z) inside the drawn street map? */
export const onMap = (x: number, z: number) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;

export function MapView({ me, players, focusId, journeyAreas, journeyStamps, labels, onArea, onPlayer, overlay }: MapViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const scrolled = useRef(false);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => setW(Math.floor(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pr = w > 0 ? makeProj(w) : null;
  const meOn = me && onMap(me.x, me.z) ? me : null;

  // on open, bring my marker (or Main Street when I am away) into the middle of the box
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!pr || !el || scrolled.current) return;
    scrolled.current = true;
    const [u, v] = pr.p(meOn?.x ?? 0, meOn?.z ?? 0);
    if (pr.vertical) el.scrollTop = Math.max(0, v - el.clientHeight / 2);
    else el.scrollLeft = Math.max(0, u - el.clientWidth / 2);
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-[min(40dvh,360px)] flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl shadow-inner ring-1 ring-black/10" style={{ background: C.grass }}>
        {pr ? <MapSvg pr={pr} me={meOn} players={players} focusId={focusId} journeyAreas={journeyAreas} journeyStamps={journeyStamps} labels={labels} onArea={onArea} onPlayer={onPlayer} /> : null}
      </div>
      {overlay ? <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-center">{overlay}</div> : null}
    </div>
  );
}

function MapSvg({ pr, me, players, focusId, journeyAreas, journeyStamps, labels, onArea, onPlayer }: Omit<MapViewProps, 'overlay'> & { pr: Proj }) {
  const { w, h } = pr;
  const p = pr.p;
  const r = (x0: number, x1: number, z0: number, z1: number) => box(pr, x0, x1, z0, z1);
  const river = r(X0, X1, RIVER_Z0, RIVER_Z1);
  const mainRoad = r(-STREET_END_X, STREET_END_X, -3.2, 3.2);
  const southRoad = r(-SOUTH_END_X, SOUTH_END_X, SOUTH_ROAD_Z - 3.2, SOUTH_ROAD_Z + 3.2);
  const shops = r(-44, 44, -12, FRONT_Z + 2);
  const waves: [number, number][] = [];
  for (let x = X0 + 20, i = 0; x < X1 - 10; x += 34, i++) if (Math.abs(Math.abs(x) - 200) > 14 && Math.abs(Math.abs(x) - BRIDGE_X) > 8) waves.push([x, i % 2 ? 23 : 32]);
  const others = players.filter((pl) => onMap(pl.x, pl.z));
  // focused player drawn last (on top)
  others.sort((a, b) => Number(a.id === focusId) - Number(b.id === focusId));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block select-none" direction="ltr" style={{ fontFamily: 'inherit' }}>
      <defs>
        <filter id="es-map-shadow" x="-20%" y="-30%" width="140%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#0f172a" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* grass with a few darker patches */}
      <rect x={0} y={0} width={w} height={h} fill={C.grass} />
      {[-250, -150, -20, 120, 230].map((x, i) => {
        const [u, v] = p(x, i % 2 ? 10 : 66);
        return <ellipse key={x} cx={u} cy={v} rx={pr.vertical ? 14 : 22} ry={pr.vertical ? 22 : 9} fill={C.grassDark} opacity={0.7} />;
      })}

      {/* river with waves */}
      <rect {...river} fill={C.river} />
      <line {...line(pr, X0, RIVER_Z0, X1, RIVER_Z0)} stroke={C.riverEdge} strokeWidth={2} />
      <line {...line(pr, X0, RIVER_Z1, X1, RIVER_Z1)} stroke={C.riverEdge} strokeWidth={2} />
      {waves.map(([x, z]) => (
        <polyline key={x} points={wave(pr, x, z)} fill="none" stroke={C.wave} strokeWidth={2} strokeLinecap="round" />
      ))}
      {[-200, 200].map((x) => {
        const [u, v] = p(x, 28);
        return (
          <text key={x} x={u} y={v + 4} fontSize={11} fontStyle="italic" fontWeight={600} textAnchor="middle" fill="#2c7fae" opacity={0.75}>
            {labels.river}
          </text>
        );
      })}

      {/* the two wooden footbridges */}
      {[-BRIDGE_X, BRIDGE_X].map((bx) => {
        const deck = r(bx - 2.2, bx + 2.2, RIVER_Z0 - 2, RIVER_Z1 + 2);
        const planks: ReturnType<typeof line>[] = [];
        for (let z = RIVER_Z0; z <= RIVER_Z1; z += 2.5) planks.push(line(pr, bx - 2.2, z, bx + 2.2, z));
        return (
          <g key={bx}>
            <rect {...deck} rx={2} fill={C.plank} stroke={C.plankDark} strokeWidth={1.5} />
            {planks.map((l, i) => (
              <line key={i} {...l} stroke={C.plankDark} strokeWidth={1} opacity={0.6} />
            ))}
          </g>
        );
      })}

      {/* roads with a dashed centre line */}
      {[
        [mainRoad, -STREET_END_X, STREET_END_X, 0],
        [southRoad, -SOUTH_END_X, SOUTH_END_X, SOUTH_ROAD_Z],
      ].map(([rect, a, b, z], i) => (
        <g key={i}>
          <rect {...(rect as ReturnType<typeof box>)} rx={4} fill={C.road} stroke={C.roadEdge} strokeWidth={1} />
          <line {...line(pr, (a as number) + 3, z as number, (b as number) - 3, z as number)} stroke="#fff" strokeWidth={1.5} strokeDasharray="7 6" opacity={0.85} />
        </g>
      ))}

      {/* Main Street shops */}
      <rect {...shops} rx={5} fill="#fde68a" stroke="#f59e0b" strokeWidth={1.5} />
      {(() => {
        // lying down the block is too short for its label: put it on the grass between the road and the river
        const [u, v] = p(0, pr.vertical ? (-12 + FRONT_Z + 2) / 2 : 10);
        return <Pill cx={u} cy={v} icon="🛍️" label={labels.shops} size={11.5} />;
      })()}

      {/* areas */}
      {AREAS.map((a) => {
        const z0 = Math.min(frontZ(a), backZ(a));
        const z1 = Math.max(frontZ(a), backZ(a));
        const rect = r(a.x0, a.x1, z0, z1);
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const info = AREA_INFO[a.id];
        const big = rect.height >= 64;
        return (
          <g key={a.id} role="button" aria-label={info.name} onClick={() => onArea(a.id)} style={{ cursor: 'pointer' }}>
            <rect {...rect} rx={10} fill={a.color} stroke="#fff" strokeOpacity={0.7} strokeWidth={2} />
            <rect x={rect.x + 3} y={rect.y + 3} width={rect.width - 6} height={rect.height - 6} rx={8} fill="#fff" opacity={0.12} />
            {big ? (
              <>
                <text x={cx} y={cy - 4} fontSize={24} textAnchor="middle">
                  {info.icon}
                </text>
                <Pill cx={cx} cy={cy + 17} label={info.short} size={12} />
              </>
            ) : (
              // lying down, neighbouring labels are staggered up/down so long names do not collide
              <Pill cx={cx} cy={cy + (pr.vertical ? 0 : stagger(a.id) * Math.min(11, rect.height / 2 - 11))} icon={info.icon} label={info.short} size={11} />
            )}
            {journeyStamps.includes(a.id) ? <StampBadge cx={rect.x + 9} cy={rect.y + 9} /> : null}
            {journeyAreas.has(a.id) ? <TaskBadge cx={rect.x + rect.width - 9} cy={rect.y + 9} /> : null}
          </g>
        );
      })}

      {/* bus stops */}
      {BUS_STOPS.map((s) => {
        const [u, v] = p(s.x, s.z);
        return (
          <g key={s.id} pointerEvents="none">
            <circle cx={u} cy={v} r={6.5} fill="#fff" stroke="#334155" strokeWidth={1.5} />
            <rect x={u - 3.2} y={v - 3.3} width={6.4} height={5.4} rx={1.3} fill="#334155" />
            <rect x={u - 2.2} y={v - 2.4} width={4.4} height={1.8} rx={0.4} fill="#fff" />
          </g>
        );
      })}

      {/* other players */}
      {others.map((pl) => {
        const [u, v] = p(pl.x, pl.z);
        const focus = pl.id === focusId;
        const col = focus ? C.focus : C.other;
        return (
          <g key={pl.id} role="button" aria-label={pl.name} onClick={() => onPlayer(pl.id)} style={{ cursor: 'pointer' }}>
            <circle cx={u} cy={v} r={14} fill="transparent" />
            {focus ? <circle cx={u} cy={v} r={10} fill={C.focus} opacity={0.25} stroke={C.focus} strokeWidth={1.5} /> : null}
            <circle cx={u} cy={v} r={focus ? 6.5 : 5} fill={col} stroke="#fff" strokeWidth={2} />
            <text x={u} y={v - (focus ? 13 : 9)} fontSize={focus ? 12 : 11} fontWeight={focus ? 800 : 700} textAnchor="middle" fill={focus ? '#7c2d12' : '#1e3a8a'} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
              {pl.name}
            </text>
          </g>
        );
      })}

      {/* me */}
      {me
        ? (() => {
            const [u, v] = p(me.x, me.z);
            return (
              <g pointerEvents="none">
                <circle cx={u} cy={v} r={8} fill={C.me} opacity={0.35}>
                  <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={u} cy={v} r={7.5} fill={C.me} stroke="#fff" strokeWidth={2.5} filter="url(#es-map-shadow)" />
                <text x={u} y={v - 13} fontSize={11} fontWeight={800} textAnchor="middle" fill="#9f1239" stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
                  {labels.you}
                </text>
              </g>
            );
          })()
        : null}
    </svg>
  );
}

/** −1 / +1 alternating along each row of areas (west to east). */
function stagger(id: AreaId) {
  const a = AREAS.find((b) => b.id === id)!;
  const row = AREAS.filter((b) => b.side === a.side).sort((b, c) => b.x0 - c.x0);
  return row.indexOf(a) % 2 ? 1 : -1;
}

function line(pr: Proj, xa: number, za: number, xb: number, zb: number) {
  const [x1, y1] = pr.p(xa, za);
  const [x2, y2] = pr.p(xb, zb);
  return { x1, y1, x2, y2 };
}

/** Tiny legend swatches (same marks as on the map). */
export function LegendMark({ kind }: { kind: 'me' | 'other' | 'task' | 'stamp' }) {
  return (
    <svg viewBox="0 0 20 20" width={14} height={14} aria-hidden>
      {kind === 'me' ? <circle cx={10} cy={10} r={6.5} fill={C.me} stroke="#fff" strokeWidth={2} /> : null}
      {kind === 'other' ? <circle cx={10} cy={10} r={6} fill={C.other} stroke="#fff" strokeWidth={2} /> : null}
      {kind === 'task' ? (
        <>
          <circle cx={10} cy={10} r={9} fill="#facc15" />
          <path d={starPath(10, 10, 5.6, 2.5)} fill="#92400e" />
        </>
      ) : null}
      {kind === 'stamp' ? (
        <>
          <circle cx={10} cy={10} r={9} fill="#22c55e" />
          <path d="M6,10.3 l2.8,2.8 l5.2,-5.6" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </svg>
  );
}
