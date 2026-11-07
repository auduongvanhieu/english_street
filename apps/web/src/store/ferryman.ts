import { create } from 'zustand';
import { PIERS } from '@es/shared';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { localPos } from '../scene/LocalPlayer';
import { useBoats } from './boats';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Taking passengers across the river: while you row a hire boat, somebody waits at a pier and asks to go to
 * another one ("Could you take me to the south ferry pier, please?"). Pick them up, row there, drop them off.
 * Rewards: minigame 'ferryman' (one point a trip, a few trips a day count).
 */
type PierId = keyof typeof PIERS;
export const PIER_NAME: Record<PierId, string> = { boatN: 'the north boat pier', boatS: 'the south boat pier', ferryN: 'the north ferry pier', ferryS: 'the south ferry pier' };
const NAMES = ['Mrs Green', 'Mr Brown', 'Lily', 'Grandpa Joe', 'Sara', 'Tom'];
const NORTH: PierId[] = ['boatN', 'ferryN'];
const SOUTH: PierId[] = ['boatS', 'ferryS'];
const REACH = 4.5;

interface FerryStore {
  job: { from: PierId; to: PierId; name: string; phase: 'pickup' | 'ride' } | null;
  trips: number;
  result: MinigameResult | null;
  last: string;
  /** offers stop for a while when you say no */
  quietUntil: number;
  decline: () => void;
}
export const useFerry = create<FerryStore>((set) => ({
  job: null,
  trips: 0,
  result: null,
  last: '',
  quietUntil: 0,
  decline: () => set({ job: null, quietUntil: Date.now() + 120_000 }),
}));

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
const tip = (p: PierId) => ({ x: PIERS[p].x, z: PIERS[p].tipZ });
export const pierTip = tip;

function newJob() {
  // start on the bank you are not near, cross the river
  const northFirst = localPos.z > 28;
  const from = pick(northFirst ? NORTH : SOUTH);
  const to = pick(northFirst ? SOUTH : NORTH);
  const name = pick(NAMES);
  useFerry.setState({ job: { from, to, name, phase: 'pickup' } });
  useVoice.getState().speakAs('boat', `A passenger is waiting at ${PIER_NAME[from]}.`, 'en-US');
  track('ferryman_offer');
}

let offerAt = 0;
/** A few times a second (scene): offers while rowing, pick-up and drop-off by distance. */
export function ferryTick() {
  const s = useFerry.getState();
  const driving = useBoats.getState().mine?.seat === 'driver';
  if (!driving) {
    if (s.job) useFerry.setState({ job: null });
    offerAt = 0;
    return;
  }
  if (!s.job) {
    if (!offerAt) offerAt = Date.now() + 5000;
    if (Date.now() >= offerAt && Date.now() >= s.quietUntil) {
      offerAt = 0;
      newJob();
    }
    return;
  }
  const j = s.job;
  const target = tip(j.phase === 'pickup' ? j.from : j.to);
  if (Math.hypot(localPos.x - target.x, localPos.z - target.z) > REACH) return;
  if (j.phase === 'pickup') {
    useFerry.setState({ job: { ...j, phase: 'ride' } });
    useVoice.getState().speakAs('passenger', `Hello! I'm ${j.name}. Could you take me to ${PIER_NAME[j.to]}, please?`, 'en-GB');
    return;
  }
  useFerry.setState({ job: null, trips: s.trips + 1, last: `${j.name}: “Thank you! Here's a little tip.”` });
  useVoice.getState().speakAs('passenger', 'Here we are. Thank you so much! Have a nice day.', 'en-GB');
  offerAt = Date.now() + 6000;
  track('ferryman_trip');
  void reportMinigame('ferryman', { score: 1 })
    .then((result) => {
      useFerry.setState({ result });
      void useProfile.getState().refresh();
    })
    .catch(() => undefined);
}
