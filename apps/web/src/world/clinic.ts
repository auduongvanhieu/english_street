import { CLINIC_ROOMS, clinicRoom } from '@es/shared';
import { registerBlockers, type Aabb } from './layout';
import { registerSeats } from './seats';
import { FRAME } from './places/hospital';

/**
 * A visit to the doctor (store/clinic.ts, scene/areas/places/Clinic.tsx): check in at the hospital reception, wait
 * for your number, go to the consulting room (off the map, one per patient slot), tell the doctor what is wrong and
 * where it hurts, then pick up the medicine at the pharmacy.
 */
export interface ClinicCase {
  id: string;
  face: string;
  /** what the patient says (the right sentence) and two that are wrong for this problem */
  says: string;
  wrong: [string, string];
  /** the reason given at reception */
  reason: string;
  /** body part (PARTS ids in ui/area/activities/Hospital.tsx) */
  part: string;
  check: string;
  diagnosis: string;
  advice: string;
  /** the right medicine and two others offered at the pharmacy */
  med: string;
  others: [string, string];
}

export const CLINIC_CASES: ClinicCase[] = [
  {
    id: 'headache',
    face: '🤕',
    says: "I've had a bad headache since yesterday.",
    wrong: ['My leg is broken.', "I've got a rash on my arm."],
    reason: "I've got a headache.",
    part: 'head',
    check: "Let me take your temperature… It's normal. Do you drink enough water?",
    diagnosis: "It's a tension headache. You need more rest and water.",
    advice: 'Take one painkiller every six hours, and drink plenty of water.',
    med: 'painkillers',
    others: ['cough syrup', 'eye drops'],
  },
  {
    id: 'sore-throat',
    face: '😣',
    says: 'My throat really hurts when I swallow.',
    wrong: ['My ear hurts when I lie down.', 'I hurt my knee playing football.'],
    reason: "I've got a sore throat.",
    part: 'neck',
    check: 'Open your mouth and say "Ahh"… Your throat is a bit red.',
    diagnosis: 'You have a throat infection, but it is not serious.',
    advice: 'Suck one lozenge every three hours and drink warm water with honey.',
    med: 'throat lozenges',
    others: ['ear drops', 'a bandage'],
  },
  {
    id: 'stomach',
    face: '🤢',
    says: 'I feel sick and my stomach hurts.',
    wrong: ['My eyes are red and itchy.', 'I cut my finger.'],
    reason: "I've got a stomach ache.",
    part: 'stomach',
    check: 'Lie down on the couch, please… Does it hurt here? What did you eat yesterday?',
    diagnosis: 'I think you ate something bad. It is a stomach upset.',
    advice: 'Take this medicine after meals and eat only plain rice and soup for two days.',
    med: 'stomach medicine',
    others: ['eye drops', 'an ice pack'],
  },
  {
    id: 'ear',
    face: '🙉',
    says: 'My ear hurts a lot, especially at night.',
    wrong: ['I have a cough.', 'My foot is swollen.'],
    reason: "I've got an earache.",
    part: 'ear',
    check: 'Let me look in your ear with this light… Yes, it is red inside.',
    diagnosis: 'You have an ear infection.',
    advice: 'Put three drops in the ear twice a day for five days. Keep it dry.',
    med: 'ear drops',
    others: ['painkillers', 'cream'],
  },
  {
    id: 'eyes',
    face: '😵',
    says: 'My eyes are red and itchy.',
    wrong: ['My stomach hurts.', 'I fell off my bike.'],
    reason: 'I have a problem with my eyes.',
    part: 'eye',
    check: 'Look up, please… and now look down. Are you allergic to anything?',
    diagnosis: 'It is an allergy, probably hay fever.',
    advice: "Put two drops in each eye, morning and evening. Don't rub your eyes.",
    med: 'eye drops',
    others: ['cough syrup', 'stomach medicine'],
  },
  {
    id: 'ankle',
    face: '⚽',
    says: 'I fell playing football and now my ankle is swollen.',
    wrong: ['I have a sore throat.', 'My ear hurts.'],
    reason: 'I hurt my ankle.',
    part: 'foot',
    check: 'Can you move your foot? Let me see… We should take an X-ray to be sure.',
    diagnosis: "Good news: it isn't broken. It is a sprained ankle.",
    advice: 'Put ice on it for twenty minutes, keep your foot up and wear this bandage.',
    med: 'an ice pack',
    others: ['throat lozenges', 'eye drops'],
  },
  {
    id: 'rash',
    face: '😖',
    says: 'I have an itchy red rash on my arm.',
    wrong: ['I have a fever.', 'My tooth hurts.'],
    reason: 'I have a rash.',
    part: 'arm',
    check: 'Let me see your arm… Did you touch any plants or new soap?',
    diagnosis: "It's an allergic rash. It isn't serious.",
    advice: "Put the cream on twice a day and try not to scratch.",
    med: 'cream',
    others: ['ear drops', 'painkillers'],
  },
  {
    id: 'cough',
    face: '😷',
    says: "I've had a bad cough for three days.",
    wrong: ['My knee hurts.', 'I have a rash.'],
    reason: "I've got a cough.",
    part: 'neck',
    check: 'Breathe in deeply… and out. I can hear a little noise in your chest.',
    diagnosis: 'You have a cold with a chesty cough.',
    advice: 'Take two spoons of syrup three times a day and rest at home.',
    med: 'cough syrup',
    others: ['cream', 'an ice pack'],
  },
];

/* ---------------------------------------------------------------------------------- hospital spots (local) */
/** Where to stand: the reception desk, the consulting-room door, the pharmacy counter (hospital local frame). */
export const RECEPTION_SPOT = FRAME.toWorld(-12, -10.8);
export const CONSULT_DOOR = { local: { x: -2, z: -20.5 }, world: FRAME.toWorld(-2, -19.9) };
export const PHARMACY_SPOT = FRAME.toWorld(11, -14.8);
/** Where you come out after the doctor: in front of the consulting-room door. */
export const AFTER_DOCTOR = FRAME.toWorld(-2, -18.6);

/* ---------------------------------------------------------------------------------- consulting rooms */
/** Furniture inside each room (room-centre offsets): desk at the back, couch on the left, cabinet on the right. */
export const ROOM_DESK = { dx: 0, dz: -1.9 };
export const ROOM_DOCTOR = { dx: 0, dz: -2.55 };
export const ROOM_CHAIR = { dx: 0, dz: -1.0 };
export const ROOM_COUCH = { dx: -2.4, dz: 0.3 };
export const ROOM_CABINET = { dx: 3.1, dz: -1.2 };

const blockers: Aabb[] = [];
const seats: Seat[] = [];
type Seat = { x: number; z: number; rot: number };
for (let i = 0; i < CLINIC_ROOMS; i++) {
  const r = clinicRoom(i);
  const { minX, maxX, minZ, maxZ } = r.rect;
  blockers.push(
    { minX: minX - 0.2, maxX, minZ: minZ - 0.2, maxZ: minZ },
    { minX: minX - 0.2, maxX: minX, minZ: minZ - 0.2, maxZ: maxZ + 0.2 },
    { minX: maxX, maxX: maxX + 0.2, minZ: minZ - 0.2, maxZ: maxZ + 0.2 },
    { minX: minX - 0.2, maxX: maxX + 0.2, minZ: maxZ, maxZ: maxZ + 0.2 },
    { minX: r.cx + ROOM_DESK.dx - 0.75, maxX: r.cx + ROOM_DESK.dx + 0.75, minZ: r.cz + ROOM_DESK.dz - 0.95, maxZ: r.cz + ROOM_DESK.dz + 0.38 },
    { minX: r.cx + ROOM_COUCH.dx - 0.4, maxX: r.cx + ROOM_COUCH.dx + 0.4, minZ: r.cz + ROOM_COUCH.dz - 1, maxZ: r.cz + ROOM_COUCH.dz + 1 },
    { minX: r.cx + ROOM_CABINET.dx - 0.25, maxX: r.cx + ROOM_CABINET.dx + 0.25, minZ: r.cz + ROOM_CABINET.dz - 0.5, maxZ: r.cz + ROOM_CABINET.dz + 0.5 },
  );
  seats.push({ x: r.cx + ROOM_CHAIR.dx, z: r.cz + ROOM_CHAIR.dz, rot: Math.PI });
}
registerBlockers(blockers);
registerSeats(seats);
