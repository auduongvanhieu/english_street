import { OLD_TOWN, inRect, type Rect } from '@es/shared';
import { registerBlockers, type Aabb } from './layout';
import { registerSeats } from './seats';

/**
 * Old Town (world coordinates, south of Riverside; OLD_TOWN in @es/shared), reached by train. The station is at the
 * top (north), then the square with the fountain and the clock tower, townhouses on both sides, and the museum
 * at the bottom (a walk-in hall with six exhibits).
 *   station z -808 … -801 · square z -852 … -811 · museum z -885 … -871 (portico to -868)
 */
export const TOWN = OLD_TOWN;
export const PLATFORM = { x0: -22, x1: 22, z0: -808, z1: -801 };
export const ARRIVE = { x: 0, z: -811 };
export const SHELTER = { x: 0, z: -803.5 };
export const FOUNTAIN = { x: 0, z: -826 };
export const TOWER = { x: 0, z: -846 };
/** Clock face centre (world) and the plane the hands are drawn on. */
export const CLOCK_FACE = { x: TOWER.x, y: 12.3, z: TOWER.z + 2.08 };
export const HOUSES: { x: number; z: number; rot: number; b: boolean }[] = [-818, -827, -836, -845, -854].flatMap((z, i) => [
  { x: -27, z, rot: Math.PI / 2, b: i % 2 === 0 },
  { x: 27, z, rot: -Math.PI / 2, b: i % 2 === 1 },
]);
export const MUSEUM = { x: 0, z: -878, w: 22, d: 14 };
export const HALL: Rect = { minX: MUSEUM.x - 10.8, maxX: MUSEUM.x + 10.8, minZ: MUSEUM.z - 6.8, maxZ: MUSEUM.z + 6.8 };
export const inMuseum = (x: number, z: number) => inRect(HALL, x, z, 0.3);
export const BENCHES: { x: number; z: number; rot: number }[] = [
  { x: -8, z: -826, rot: Math.PI / 2 },
  { x: 8, z: -826, rot: -Math.PI / 2 },
  { x: -12, z: -840, rot: Math.PI / 2 },
  { x: 12, z: -840, rot: -Math.PI / 2 },
];
export const LANTERNS: [number, number][] = [
  [-16, -815],
  [16, -815],
  [-16, -835],
  [16, -835],
  [-16, -855],
  [16, -855],
  [-6, -866],
  [6, -866],
];

/** Exhibits in the museum: what stands there, the plaque, a reading question (first answer is right). */
export interface Exhibit {
  id: string;
  model: string;
  /** stands on a pedestal (else on the floor) */
  pedestal: boolean;
  x: number;
  z: number;
  /** the plaque faces the middle aisle: +1 east, -1 west */
  face: 1 | -1;
  title: string;
  plaque: string;
  q: string;
  answers: [string, string, string];
}
const L = MUSEUM.x - 6.5;
const R = MUSEUM.x + 6.5;
export const EXHIBITS: Exhibit[] = [
  { id: 'map', model: 'SM_OT_Map', pedestal: false, x: L, z: -874.5, face: 1, title: 'The Old Map', plaque: 'This map of Old Town was drawn in 1750. The town had only twelve streets then, and the river was much wider.', q: 'How many streets did the town have in 1750?', answers: ['Twelve.', 'Twenty.', 'Two.'] },
  { id: 'helmet', model: 'SM_OT_Helmet', pedestal: true, x: L, z: -878.5, face: 1, title: "A Knight's Helmet", plaque: 'A knight wore this helmet in 1420. It weighs four kilograms. He fought for the king of England.', q: 'When did the knight wear this helmet?', answers: ['In 1420.', 'In 1240.', 'In 1820.'] },
  { id: 'crown', model: 'SM_OT_Crown', pedestal: true, x: L, z: -882.5, face: 1, title: "Queen Matilda's Crown", plaque: 'Queen Matilda wore this crown at her wedding in 1610. She visited Old Town every summer.', q: 'When did Queen Matilda visit Old Town?', answers: ['Every summer.', 'Every winter.', 'Only once.'] },
  { id: 'ship', model: 'SM_OT_Ship', pedestal: true, x: R, z: -874.5, face: -1, title: 'The Maple Star', plaque: "The ship 'Maple Star' sailed from Old Town to Canada in 1847. The trip took six weeks.", q: 'How long did the trip to Canada take?', answers: ['Six weeks.', 'Six days.', 'Six months.'] },
  { id: 'bike', model: 'SM_OT_Bicycle', pedestal: false, x: R, z: -878.5, face: -1, title: 'The Penny-farthing', plaque: 'People rode bicycles like this in the 1880s. The big front wheel was fast, but it was dangerous to fall off.', q: 'Why was this bicycle dangerous?', answers: ['People fell off the big wheel.', 'It had no seat.', 'It was very slow.'] },
  { id: 'phone', model: 'SM_OT_Phone', pedestal: true, x: R, z: -882.5, face: -1, title: 'The First Telephone', plaque: 'The first telephone arrived in Old Town in 1905. Only the doctor and the hotel had one.', q: 'Who had a telephone in 1905?', answers: ['The doctor and the hotel.', 'Every family.', 'The school and the bank.'] },
];
/** Where you stand to look at an exhibit (in the aisle, in front of it). */
export const exhibitSpot = (e: Exhibit) => ({ x: e.x + e.face * 1.6, z: e.z });

const t = 0.3;
const box = (x: number, z: number, hx: number, hz: number): Aabb => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
const W2 = MUSEUM.w / 2;
const D2 = MUSEUM.d / 2;
export const BLOCKERS: Aabb[] = [
  { minX: TOWN.minX - t, maxX: TOWN.minX, minZ: TOWN.minZ, maxZ: TOWN.maxZ },
  { minX: TOWN.maxX, maxX: TOWN.maxX + t, minZ: TOWN.minZ, maxZ: TOWN.maxZ },
  { minX: TOWN.minX, maxX: TOWN.maxX, minZ: PLATFORM.z1, maxZ: PLATFORM.z1 + t },
  { minX: TOWN.minX, maxX: TOWN.maxX, minZ: TOWN.minZ - t, maxZ: TOWN.minZ },
  box(SHELTER.x, SHELTER.z + 1.15, 3.1, 0.15),
  box(FOUNTAIN.x, FOUNTAIN.z, 1.9, 1.9),
  box(TOWER.x, TOWER.z, 2.3, 2.3),
  ...HOUSES.map((h) => box(h.x, h.z, 3.1, 2.6)),
  ...BENCHES.map((b) => (Math.abs(Math.sin(b.rot)) > 0.5 ? box(b.x, b.z, 0.25, 0.8) : box(b.x, b.z, 0.8, 0.25))),
  ...LANTERNS.map(([x, z]) => box(x, z, 0.15, 0.15)),
  // the museum hall: back, sides, front with the doorway, the portico columns
  box(MUSEUM.x, MUSEUM.z - D2 + 0.2, W2, 0.25),
  box(MUSEUM.x - W2 + 0.2, MUSEUM.z, 0.25, D2),
  box(MUSEUM.x + W2 - 0.2, MUSEUM.z, 0.25, D2),
  { minX: MUSEUM.x - W2, maxX: MUSEUM.x - 1.5, minZ: MUSEUM.z + D2 - 0.45, maxZ: MUSEUM.z + D2 },
  { minX: MUSEUM.x + 1.5, maxX: MUSEUM.x + W2, minZ: MUSEUM.z + D2 - 0.45, maxZ: MUSEUM.z + D2 },
  ...[-4.2, -1.6, 1.6, 4.2].map((x) => box(MUSEUM.x + x, MUSEUM.z + D2 + 1.8, 0.38, 0.38)),
  ...EXHIBITS.map((e) => box(e.x, e.z, e.pedestal ? 0.45 : 0.8, e.pedestal ? 0.45 : 0.6)),
];
registerBlockers(BLOCKERS);
registerSeats([
  ...[-1, 0, 1].map((k) => ({ x: SHELTER.x + k * 0.9, z: SHELTER.z + 0.55, rot: Math.PI })),
  ...BENCHES.flatMap((b) => [-0.4, 0.4].map((d) => ({ x: b.x + Math.cos(b.rot) * d, z: b.z - Math.sin(b.rot) * d, rot: b.rot }))),
]);
