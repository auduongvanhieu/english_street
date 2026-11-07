import { create } from 'zustand';
import { clinicRoom, clinicRoomFor, inRect } from '@es/shared';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { getPlayerId } from '../net/player';
import { chimeSound } from '../audio/ambient';
import { localPos, teleportTo } from '../scene/LocalPlayer';
import { AFTER_DOCTOR, CLINIC_CASES, type ClinicCase } from '../world/clinic';
import { useArea } from './area';
import { useProfile } from './profile';
import { useSeat } from './seat';
import { useSettings } from './settings';
import { useVoice } from './voice';

/**
 * A visit to the doctor (world/clinic.ts): reception → waiting room → consulting room → pharmacy.
 * Score (0-3): the right sentence for the doctor, the right body part, the right medicine — each first time.
 */
export type ClinicStage = 'checkin' | 'waiting' | 'called' | 'talk' | 'where' | 'check' | 'advice' | 'pharmacy' | 'done';
interface ClinicStore {
  stage: ClinicStage | null;
  c: ClinicCase | null;
  number: number;
  room: number;
  callAt: number;
  /** shuffled options of the current question */
  options: string[];
  miss: string | null;
  score: { talk: boolean; where: boolean; med: boolean };
  firstTry: boolean;
  result: MinigameResult | null;
  /** reception: answer "What seems to be the problem?" */
  start: () => void;
  checkin: (reason: string) => void;
  enterRoom: () => void;
  tell: (line: string) => void;
  point: (part: string) => void;
  next: () => void;
  leaveRoom: () => void;
  openPharmacy: () => void;
  pickMed: (med: string) => void;
  close: () => void;
}

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const nurse = (t: string) => useVoice.getState().speakAs('nurse', t, 'en-GB');
const doctor = (t: string) => useVoice.getState().speakAs('doctor', t, 'en-US');
const pharmacist = (t: string) => useVoice.getState().speakAs('pharmacist', t, 'en-GB');
const ROOM_NAME = (r: number) => `Consulting Room ${r + 1}`;

export const useClinic = create<ClinicStore>((set, get) => ({
  stage: null,
  c: null,
  number: 0,
  room: 0,
  callAt: 0,
  options: [],
  miss: null,
  score: { talk: false, where: false, med: false },
  firstTry: true,
  result: null,
  start() {
    const st = get().stage;
    if (st && st !== 'done') return; // already in a visit
    const c = CLINIC_CASES[Math.floor(Math.random() * CLINIC_CASES.length)]!;
    const others = shuffle(CLINIC_CASES.filter((x) => x.reason !== c.reason)).slice(0, 2).map((x) => x.reason);
    set({ stage: 'checkin', c, options: shuffle([c.reason, ...others]), miss: null, score: { talk: false, where: false, med: false }, firstTry: true, result: null, room: clinicRoomFor(getPlayerId()) });
    nurse('Good morning! What seems to be the problem?');
    track('hospital_checkin');
  },
  checkin(reason) {
    const { c, stage } = get();
    if (!c || stage !== 'checkin') return;
    if (reason !== c.reason) {
      set({ miss: reason });
      nurse("I'm sorry, is that right? Look at how you feel today.");
      return;
    }
    const number = 10 + Math.floor(Math.random() * 40);
    set({ stage: 'waiting', number, callAt: Date.now() + 12_000, miss: null });
    nurse(`Thank you. Please take a seat in the waiting room. Your number is ${number}.`);
  },
  enterRoom() {
    const { stage, c } = get();
    if (stage !== 'called' || !c) return;
    useSeat.getState().stand();
    const r = clinicRoom(get().room);
    teleportTo(r.entry.x, r.entry.z, Math.PI);
    set({ stage: 'talk', options: shuffle([c.says, ...c.wrong]), miss: null, firstTry: true });
    window.setTimeout(() => doctor("Hello! Come in and sit down, please. What's the matter?"), 900);
  },
  tell(line) {
    const { c, stage, firstTry, score } = get();
    if (!c || stage !== 'talk') return;
    if (line !== c.says) {
      set({ miss: line, firstTry: false });
      doctor("Hmm, are you sure? Tell me again: how do you feel?");
      return;
    }
    useVoice.getState().speakAs('me', line, 'en-US');
    set({ stage: 'where', score: { ...score, talk: firstTry }, miss: null, firstTry: true });
    window.setTimeout(() => doctor("I see. Where does it hurt? Show me, please."), 2200);
  },
  point(part) {
    const { c, stage, firstTry, score } = get();
    if (!c || stage !== 'where') return;
    if (part !== c.part) {
      set({ miss: part, firstTry: false });
      doctor(`Your ${part}? Hmm, are you sure it hurts there?`);
      return;
    }
    set({ stage: 'check', score: { ...score, where: firstTry }, miss: null });
    doctor(c.check);
  },
  next() {
    const { c, stage } = get();
    if (!c) return;
    if (stage === 'check') {
      set({ stage: 'advice' });
      doctor(`${c.diagnosis} ${c.advice} Take this prescription to the pharmacy.`);
    }
  },
  leaveRoom() {
    const { stage, c } = get();
    if (stage !== 'advice' || !c) return;
    useVoice.getState().speakAs('me', 'Thank you, doctor. Goodbye!', 'en-US');
    useSeat.getState().stand();
    teleportTo(AFTER_DOCTOR[0], AFTER_DOCTOR[1], 0);
    set({ stage: 'pharmacy', options: shuffle([c.med, ...c.others]), miss: null, firstTry: true });
  },
  openPharmacy() {
    if (get().stage !== 'pharmacy') return;
    pharmacist('Hello! Can I see your prescription, please?');
  },
  pickMed(med) {
    const { c, stage, firstTry, score } = get();
    if (!c || stage !== 'pharmacy') return;
    if (med !== c.med) {
      set({ miss: med, firstTry: false });
      pharmacist("That isn't right for this prescription. Read it again, please.");
      return;
    }
    const final = { ...score, med: firstTry };
    set({ stage: 'done', score: final, miss: null });
    pharmacist(`Here you are: ${c.med}. ${c.advice} Get well soon!`);
    const pts = Number(final.talk) + Number(final.where) + Number(final.med);
    track('hospital_visit_done', { case: c.id, score: pts });
    void reportMinigame('clinic', { score: pts })
      .then((result) => {
        set({ result });
        void useProfile.getState().refresh();
      })
      .catch(() => undefined);
  },
  close: () => set({ stage: null, c: null, miss: null }),
}));

/** Waiting room: call the number when it is time (called ~4×/s by the hospital scene and the clinic room). */
export function clinicTick() {
  const s = useClinic.getState();
  if (s.stage === 'waiting' && Date.now() >= s.callAt) {
    chimeSound(Math.max(0.3, useSettings.getState().ambientVolume));
    window.setTimeout(() => nurse(`Number ${s.number}, please go to ${ROOM_NAME(s.room)}.`), 900);
    useClinic.setState({ stage: 'called' });
  }
  // left the consulting room another way (map, bus…) during the exam: back to the pharmacy step is not possible; end
  if ((s.stage === 'talk' || s.stage === 'where' || s.stage === 'check' || s.stage === 'advice') && !inRect(clinicRoom(s.room).rect, localPos.x, localPos.z, 2)) {
    useClinic.setState({ stage: null, c: null });
  }
}
export const roomName = ROOM_NAME;

// leaving the hospital before the doctor: the visit is cancelled
useArea.subscribe((st, prev) => {
  const s = useClinic.getState();
  if (st.current !== prev.current && prev.current === 'hospital' && (s.stage === 'checkin' || s.stage === 'waiting' || s.stage === 'called')) useClinic.setState({ stage: null, c: null });
});
