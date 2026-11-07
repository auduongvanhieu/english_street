import { useJourney } from '../../store/journey';
import { MAIN_STEPS, stepById } from '@es/shared';
import { useEffect, useState } from 'react';
import { AREA_INFO, type AreaId } from '@es/shared';
import { useGame } from '../../store/game';
import { useDm } from '../../store/dm';
import { useRestaurant } from '../../store/restaurant';
import { BUS_STOPS, type StopId } from '../../world/areas';
import { Icon } from '../icons';
import { placeOf } from '../PlayersPanel';
import { LegendMark, MapView, onMap } from './MapView';
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
import { TAXI_PRICE } from '@es/shared';
import { post } from '../../net/api';
import { getPlayerId } from '../../net/player';
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

/** A taxi (premium): pay, a short fade, and you are at the area's gate. */
export async function taxiTo(id: StopId) {
  useRestaurant.getState().stand();
  useGame.getState().setUiPanel(null);
  if (useBus.getState().ride) return;
  try {
    await post<{ coins: number }>('/me/taxi', { playerId: getPlayerId() });
  } catch (e) {
    say((e as Error).message);
    return;
  }
  if (myHolding()) sendHold('');
  const s = BUS_STOPS.find((b) => b.id === id)!;
  say(`Take me to ${STOP_NAME(id)}, please.`);
  useBus.setState({ fade: 1 });
  window.setTimeout(() => {
    teleportTo(s.x + 1.5, s.z - 1.6, Math.PI);
    useBus.setState({ fade: 0 });
    say(`Here we are: ${STOP_NAME(id)}. That's ${TAXI_PRICE} coins, please. Thank you!`);
    void useProfile.getState().refresh();
  }, 900);
  track('taxi_ride', { to: id });
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

/** Open the private-message thread with a player in the 👥 panel. */
function openThread(id: string) {
  useDm.getState().open(id);
  useGame.getState().setUiPanel('players');
}

/** 🗺️ Street map: areas, the main street, you and other players; tap a place to take the bus there. */
/** Areas where the journey has something for me now (current chapter, tracked and today's tasks). */
function useJourneyAreas() {
  const view = useJourney((s) => s.view);
  const out = new Set<string>();
  if (view) {
    const ids = [MAIN_STEPS[view.chapter]?.id, ...view.state.tracked, ...view.state.daily.filter((d) => !view.state.dailyDone.includes(d))];
    for (const id of ids) {
      const st = id ? stepById(id) : undefined;
      if (st?.guide && 'area' in st.guide) out.add(st.guide.area);
      if (st?.area && st.area !== 'river') out.add(st.area);
    }
  }
  return { journeyAreas: out, journeyStamps: view?.stamps ?? [] };
}

export function MapPanel() {
  const { journeyAreas, journeyStamps } = useJourneyAreas();
  const t = useT();
  const close = useGame((s) => s.setUiPanel);
  const players = useGame((s) => s.players);
  const me = useGame((s) => s.sessionId);
  const mapFocus = useDm((s) => s.mapFocus);
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(iv);
  }, []);
  const myPos = { x: localPos.x, z: localPos.z };
  const [taxi, setTaxi] = useState(false);
  // far from the street map (train trip, Sunny Bay, a room inside…): say where I am instead of a marker
  const away = !onMap(myPos.x, myPos.z);
  const where = away ? placeOf(myPos.x, myPos.z) : null;
  return (
    <Sheet onClose={() => close(null)} label={t('Map')} wide="xl">
      <SheetHeader>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Icon name="map" className="text-slate-700" /> {t('Map')}
        </h2>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 pt-2.5 sm:px-5 sm:pb-4">
        {/* how to get there: the bus (free) or a taxi (premium) */}
        <div className="flex gap-1.5 text-xs font-semibold">
          <button type="button" onClick={() => setTaxi(false)} className={`flex-1 rounded-full py-1.5 ${!taxi ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-700'}`}>
            🚌 {t('Bus · free')}
          </button>
          <button type="button" onClick={() => setTaxi(true)} className={`flex-1 rounded-full py-1.5 ${taxi ? 'bg-amber-500 text-white' : 'bg-gray-100 text-slate-700'}`}>
            🚕 {t('Taxi · {n} coins, no waiting', { n: TAXI_PRICE })}
          </button>
        </div>
        <MapView
          me={away ? null : myPos}
          players={Object.values(players).filter((p) => p.id !== me)}
          focusId={mapFocus}
          journeyAreas={journeyAreas}
          journeyStamps={journeyStamps}
          labels={{ shops: t('Main Street shops'), river: t('River'), you: t('You') }}
          onArea={(id) => (taxi ? void taxiTo(id) : rideTo(id))}
          onPlayer={openThread}
          overlay={
            where ? (
              <span className="max-w-full truncate rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow-md ring-1 ring-black/5">
                📍 {t('You are away from the street')}: {where.icon} <span dir="ltr">{where.name}</span>
              </span>
            ) : null
          }
        />
        <div className="shrink-0 space-y-1">
          <div className="flex flex-wrap justify-center gap-1">
            {(
              [
                ['me', t('You')],
                ['other', t('Other players')],
                ['task', t('Journey task')],
                ['stamp', t('Stamp')],
              ] as const
            ).map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-black/5">
                <LegendMark kind={k} /> {label}
              </span>
            ))}
          </div>
          <p className="text-center text-[11px] leading-snug text-slate-500">
            {taxi ? t('Tap a place to go there by taxi.') : t('Tap a place to take the bus there.')} {t('Tap a player to message them.')}
          </p>
        </div>
        <div className="shrink-0 space-y-1.5">
          <ByTrain />
          <Suggested />
        </div>
      </div>
    </Sheet>
  );
}

/** Places reached by train: take the bus to Central Station, where the ticket office is. */
const TRAIN_PLACES = [
  ['🌊', 'Riverside'],
  ['🍁', 'Maple Hill'],
  ['🏰', 'Old Town'],
  ['🏖️', 'Sunny Bay'],
] as const;

function ByTrain() {
  const t = useT();
  return (
    <section className="rounded-2xl bg-sky-50/80 px-2.5 py-2 ring-1 ring-sky-200">
      <h3 className="mb-1.5 truncate text-[11px] text-sky-800/90">
        <b className="text-xs font-semibold text-sky-900">🚆 {t('By train')}</b> · {t('Take the bus to the station and buy a ticket.')}
      </h3>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {TRAIN_PLACES.map(([icon, name]) => (
          <button key={name} type="button" onClick={() => rideTo('station')} className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-black/5 hover:bg-sky-100">
            {icon} <span dir="ltr">{name}</span>
          </button>
        ))}
      </div>
    </section>
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
    <section className="rounded-2xl bg-emerald-50/80 px-2.5 py-2 ring-1 ring-emerald-200">
      <h3 className="mb-1.5 truncate text-xs font-semibold text-emerald-900">✨ {t('Good next places for your level ({level})', { level: level ?? 'A1' })}</h3>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {list.map((id) => (
          <button key={id} type="button" onClick={() => rideTo(id)} className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-black/5 hover:bg-emerald-100">
            {AREA_INFO[id].icon} <span dir="ltr">{AREA_INFO[id].short}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
