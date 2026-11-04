import { useEffect, useState } from 'react';
import type { AreaId } from '@es/shared';
import { useGame } from '../../store/game';
import { useRestaurant } from '../../store/restaurant';
import { AREAS, BUS_STOPS, GATE_X, STREET_END_X } from '../../world/areas';
import { localPos, teleportTo } from '../../scene/LocalPlayer';
import { track } from '../../net/analytics';
import { useT } from '../../i18n';
import { Sheet, SheetHeader } from '../Sheet';
import { say } from './common';

const STOP_NAME: Record<'main' | AreaId, string> = {
  main: 'Main Street',
  zoo: 'Sunny Hills Zoo',
  farm: 'Green Valley Farm',
  supermarket: 'FreshWay Supermarket',
  restaurant: 'The Grand Garden Restaurant',
};
const STOP_ICON: Record<'main' | AreaId, string> = { main: '🏙️', zoo: '🦁', farm: '🐄', supermarket: '🛒', restaurant: '🍽️' };

/** Ride the bus: jump to a stop, hear "Next stop: …". */
export function rideTo(id: 'main' | AreaId) {
  const s = BUS_STOPS.find((b) => b.id === id)!;
  useRestaurant.getState().stand();
  // Step off just north of the stop, facing the area across the road.
  teleportTo(s.x + 1.5, s.z - 1.6, Math.PI);
  say(`Next stop: ${STOP_NAME[id]}.`);
  track('bus_ride', { to: id });
  useGame.getState().setUiPanel(null);
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
        {(['supermarket', 'restaurant', 'main', 'zoo', 'farm'] as const).map((id) => (
          <button key={id} type="button" onClick={() => rideTo(id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left hover:bg-gray-50">
            <span className="text-2xl">{STOP_ICON[id]}</span>
            <span className="flex-1 font-medium" dir="ltr">
              {STOP_NAME[id]}
            </span>
            <span className="text-gray-400">→</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

const MAP_W = 340;
const X0 = -STREET_END_X;
const sx = (x: number) => ((x - X0) / (2 * STREET_END_X)) * MAP_W;
const sz = (z: number) => ((z + 32) / 52) * 110; // z -32…20 → 0…110

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
        <svg viewBox={`0 0 ${MAP_W} 110`} className="w-full rounded-xl bg-[#a8d27a]" direction="ltr">
          <rect x={0} y={sz(18)} width={MAP_W} height={sz(38) - sz(18)} fill="#5ab0dc" />
          <rect x={0} y={sz(-2.2)} width={MAP_W} height={sz(2.2) - sz(-2.2)} fill="#555b61" />
          <rect x={sx(-GATE_X)} y={sz(-10)} width={sx(GATE_X) - sx(-GATE_X)} height={sz(-4) - sz(-10)} fill="#f2c94c" opacity={0.8} rx={2} />
          <text x={sx(0)} y={sz(-12)} fontSize={6} textAnchor="middle" fill="#333">
            Main Street · shops
          </text>
          {AREAS.map((a) => (
            <g key={a.id} onClick={() => rideTo(a.id)} style={{ cursor: 'pointer' }}>
              <rect x={sx(a.x0)} y={sz(-29.5)} width={sx(a.x1) - sx(a.x0)} height={sz(-6) - sz(-29.5)} fill={a.color} opacity={0.85} rx={3} />
              <text x={sx((a.x0 + a.x1) / 2)} y={sz(-19)} fontSize={10} textAnchor="middle">
                {a.icon}
              </text>
              <text x={sx((a.x0 + a.x1) / 2)} y={sz(-10)} fontSize={5} textAnchor="middle" fill="#fff" fontWeight={700}>
                {a.name}
              </text>
            </g>
          ))}
          {Object.values(players)
            .filter((p) => p.id !== me)
            .map((p) => (
              <circle key={p.id} cx={sx(p.x)} cy={sz(p.z)} r={1.6} fill="#2f80ed" />
            ))}
          <circle cx={sx(localPos.x)} cy={sz(localPos.z)} r={3} fill="#e5533d" stroke="#fff" strokeWidth={1} />
        </svg>
        <p className="mt-2 text-center text-xs text-gray-500">
          🔴 {t('You')} · 🔵 {t('Other players')} · {t('Tap a place to take the bus there.')}
        </p>
      </div>
    </Sheet>
  );
}
