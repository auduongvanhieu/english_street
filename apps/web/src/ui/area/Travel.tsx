import { useEffect, useState } from 'react';
import { AREA_INFO, type AreaId } from '@es/shared';
import { useGame } from '../../store/game';
import { useRestaurant } from '../../store/restaurant';
import { AREAS, BRIDGE_X, BUS_STOPS, GATES_X, SOUTH_BACK_Z, SOUTH_END_X, SOUTH_FRONT_Z, SOUTH_ROAD_Z, STREET_END_X, YARD_MIN_Z, FRONT_Z, frontZ, backZ, type StopId } from '../../world/areas';
import { useProfile } from '../../store/profile';
import { suggestAreas } from './suggest';
import { useArea } from '../../store/area';
const useAreaLearned = () => useArea((s) => s.learned);
import { localPos, teleportTo } from '../../scene/LocalPlayer';
import { setBusVoice, startRide, useBus } from '../../store/bus';
import { sendHold } from '../../net/client';
import { myHolding } from '../../world/hold';
import { track } from '../../net/analytics';
import { useT } from '../../i18n';
import { Sheet, SheetHeader } from '../Sheet';
import { say } from './common';

const STOP_NAME = (id: StopId) => (id === 'main' ? 'Main Street' : AREA_INFO[id].name);
const STOP_ICON = (id: StopId) => (id === 'main' ? '🏙️' : AREA_INFO[id].icon);

setBusVoice(say);

/**
 * Ride the bus: walk to the nearest stop's kerb (or appear there when far away), board the shared bus, ride,
 * step off at the destination (store/bus.ts). Without a game server connection: the old instant jump.
 */
export function rideTo(id: StopId) {
  useRestaurant.getState().stand();
  useGame.getState().setUiPanel(null);
  if (useBus.getState().ride) return;
  if (!useGame.getState().sessionId) {
    const s = BUS_STOPS.find((b) => b.id === id)!;
    teleportTo(s.x + 1.5, s.z - 1.6, Math.PI);
    say(`Next stop: ${STOP_NAME(id)}.`);
    track('bus_ride', { to: id });
    return;
  }
  if (myHolding()) sendHold('');
  const r = startRide(id, { x: localPos.x, z: localPos.z });
  if (r.teleport) teleportTo(r.teleport.x, r.teleport.z, Math.PI);
}

export function BusPanel() {
  const t = useT();
  const close = useGame((s) => s.setUiPanel);
  return (
    <Sheet onClose={() => close(null)} label={t('Bus')}>
      <SheetHeader>
        <h2 className="text-lg font-bold">🚌 {t('Where do you want to go?')}</h2>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 sm:px-5">
        <p className="text-xs text-gray-500" dir="ltr">
          “Excuse me, does this bus go to the zoo?” — “Yes, it does. Hop on!”
        </p>
        <Suggested />
        {(
          [
            [t('Main Street'), BUS_STOPS.filter((s) => s.road === 0)],
            [t('South Bank (across the river)'), BUS_STOPS.filter((s) => s.road !== 0)],
          ] as const
        ).map(([title, stops]) => (
          <section key={title} className="space-y-1.5">
            <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
            {[...stops]
              .sort((a, b) => a.x - b.x)
              .map(({ id }) => (
                <button key={id} type="button" onClick={() => rideTo(id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left hover:bg-gray-50">
                  <span className="text-2xl">{STOP_ICON(id)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium" dir="ltr">
                      {STOP_NAME(id)}
                    </span>
                    {id !== 'main' ? (
                      <span className="block truncate text-[11px] text-gray-500">
                        {t(AREA_INFO[id].topic)} · {AREA_INFO[id].level}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-gray-400">→</span>
                </button>
              ))}
          </section>
        ))}
      </div>
    </Sheet>
  );
}

const X0 = -STREET_END_X - 4;
const MAP_W = 640;
const Z0 = -34;
const Z1 = SOUTH_BACK_Z + 4;
const SCALE = MAP_W / (2 * -X0);
const MAP_H = (Z1 - Z0) * SCALE;
const sx = (x: number) => (x - X0) * SCALE;
const sz = (z: number) => (z - Z0) * SCALE;

/** 🗺️ Street map: areas, the main street, you and other players; tap a place to take the bus there. */
export function MapPanel() {
  const t = useT();
  const close = useGame((s) => s.setUiPanel);
  const players = useGame((s) => s.players);
  const me = useGame((s) => s.sessionId);
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(iv);
  }, []);
  return (
    <Sheet onClose={() => close(null)} label={t('Map')} wide>
      <SheetHeader>
        <h2 className="text-lg font-bold">🗺️ {t('Map')}</h2>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="px-3 pb-4 sm:px-5">
        <div className="overflow-x-auto rounded-xl">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full min-w-[640px] rounded-xl bg-[#a8d27a]" direction="ltr">
            {/* river, bridges, main road, south-bank road */}
            <rect x={0} y={sz(18)} width={MAP_W} height={sz(38) - sz(18)} fill="#5ab0dc" />
            {[-BRIDGE_X, BRIDGE_X].map((x) => (
              <rect key={x} x={sx(x) - 2} y={sz(16)} width={4} height={sz(40) - sz(16)} fill="#9c7a52" />
            ))}
            <rect x={sx(-STREET_END_X)} y={sz(-3.2)} width={sx(STREET_END_X) - sx(-STREET_END_X)} height={sz(3.2) - sz(-3.2)} fill="#555b61" />
            <rect x={sx(-SOUTH_END_X)} y={sz(SOUTH_ROAD_Z - 3.2)} width={sx(SOUTH_END_X) - sx(-SOUTH_END_X)} height={6.4 * SCALE} fill="#555b61" />
            {GATES_X.flatMap((g) => [-g, g]).map((g) => (
              <rect key={g} x={sx(g) - 0.8} y={sz(-6)} width={1.6} height={12 * SCALE} fill="#3f7f4f" />
            ))}
            <rect x={sx(-44)} y={sz(-12)} width={sx(44) - sx(-44)} height={sz(FRONT_Z + 2) - sz(-12)} fill="#f2c94c" opacity={0.8} rx={2} />
            <text x={sx(0)} y={sz(-14)} fontSize={7} textAnchor="middle" fill="#333">
              Main Street · shops
            </text>
            {AREAS.map((a) => {
              const z0 = Math.min(frontZ(a), backZ(a));
              const z1 = Math.max(frontZ(a), backZ(a));
              const cy = (sz(z0) + sz(z1)) / 2;
              return (
                <g key={a.id} onClick={() => rideTo(a.id)} style={{ cursor: 'pointer' }}>
                  <rect x={sx(a.x0)} y={sz(z0)} width={sx(a.x1) - sx(a.x0)} height={sz(z1) - sz(z0)} fill={a.color} opacity={0.88} rx={3} />
                  <text x={sx((a.x0 + a.x1) / 2)} y={cy - 2} fontSize={13} textAnchor="middle">
                    {a.icon}
                  </text>
                  <text x={sx((a.x0 + a.x1) / 2)} y={cy + 10} fontSize={6.5} textAnchor="middle" fill="#fff" fontWeight={700}>
                    {AREA_INFO[a.id].short}
                  </text>
                </g>
              );
            })}
            {Object.values(players)
              .filter((p) => p.id !== me)
              .map((p) => (
                <circle key={p.id} cx={sx(p.x)} cy={sz(p.z)} r={2} fill="#2f80ed" />
              ))}
            <circle cx={sx(localPos.x)} cy={sz(localPos.z)} r={3.6} fill="#e5533d" stroke="#fff" strokeWidth={1.2} />
          </svg>
        </div>
        <p className="mt-2 text-center text-xs text-gray-500">
          🔴 {t('You')} · 🔵 {t('Other players')} · {t('Tap a place to take the bus there.')}
        </p>
        <div className="mt-3">
          <Suggested />
        </div>
      </div>
    </Sheet>
  );
}

/** "Good next places for your level": areas matching the learner's CEFR level that they have not finished yet. */
function Suggested() {
  const t = useT();
  const level = useProfile((s) => s.profile?.cefrLevel);
  const learned = useAreaLearned();
  const list = suggestAreas(level ?? 'A1', learned).slice(0, 3);
  if (!list.length) return null;
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
      <h3 className="mb-1.5 text-xs font-semibold text-emerald-900">✨ {t('Good next places for your level ({level})', { level: level ?? 'A1' })}</h3>
      <div className="flex flex-wrap gap-1.5">
        {list.map((id) => (
          <button key={id} type="button" onClick={() => rideTo(id)} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium">
            {AREA_INFO[id].icon} <span dir="ltr">{AREA_INFO[id].short}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
