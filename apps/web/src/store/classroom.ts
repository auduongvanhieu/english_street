import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { bellSound } from '../audio/ambient';
import { classPhase, type ClassPhase } from '../world/lessons';
import { useGame } from './game';
import { useProfile } from './profile';
import { useSettings } from './settings';
import { useVoice } from './voice';

/**
 * Maple School's timed class (world/lessons.ts): being in the classroom while the lesson runs means taking part.
 * The teacher reads each slide; in the quiz you put up your hand and answer; after the last question the score goes
 * to the minigame board ('class').
 */
interface ClassStore {
  inRoom: boolean;
  /** lesson number being followed (server clock / LESSON_MS) */
  n: number;
  phase: ClassPhase | null;
  slidesSeen: number;
  /** question index -> picked option (only while the question is open) */
  answers: Record<number, number>;
  hand: boolean;
  result: { n: number; correct: number; total: number; reward: MinigameResult | null } | null;
  putUpHand: () => void;
  answer: (q: number, k: number) => void;
  closeResult: () => void;
}

const teacher = (text: string) => useVoice.getState().speakAs('teacher', text, 'en-GB');

export const useClassroom = create<ClassStore>((set, get) => ({
  inRoom: false,
  n: -1,
  phase: null,
  slidesSeen: 0,
  answers: {},
  hand: false,
  result: null,
  putUpHand() {
    if (get().hand) return;
    set({ hand: true });
    useGame.getState().playEmote('wave');
  },
  answer(q, k) {
    const p = get().phase;
    if (!p || p.phase !== 'quiz' || p.q !== q || get().answers[q] !== undefined) return;
    set({ answers: { ...get().answers, [q]: k }, hand: false });
    const right = p.lesson.quiz[q]!.answer === k;
    teacher(right ? pick(['Very good!', "That's right!", 'Well done!']) : `Good try. The answer is: ${p.lesson.quiz[q]!.options[p.lesson.quiz[q]!.answer]}.`);
  },
  closeResult: () => set({ result: null }),
}));

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;

/** Called ~4×/s by the school scene. */
export function classTick(inRoom: boolean, now: number) {
  const s = useClassroom.getState();
  const p = classPhase(now);
  const prev = s.phase;
  const patch: Partial<ClassStore> = { phase: p };
  if (inRoom !== s.inRoom) patch.inRoom = inRoom;
  // a new lesson: start fresh
  if (p.n !== s.n) Object.assign(patch, { n: p.n, slidesSeen: 0, answers: {}, hand: false });
  const fresh = p.n !== s.n;
  const changed = (k: (x: ClassPhase) => string) => fresh || !prev || k(prev) !== k(p);
  if (inRoom) {
    if (p.phase === 'bell' && changed((x) => x.phase)) {
      bellSound(Math.max(0.3, useSettings.getState().ambientVolume));
      teacher(`Good morning, class! Please sit down. Today's lesson is: ${p.lesson.title}.`);
    }
    if (p.phase === 'slide' && changed((x) => `${x.phase}${x.slide}`)) {
      const sl = p.lesson.slides[p.slide]!;
      teacher(`${sl.word}. ${sl.say}`);
      patch.slidesSeen = (fresh ? 0 : s.slidesSeen) + 1;
    }
    if (p.phase === 'quiz' && changed((x) => `${x.phase}${x.q}`)) {
      teacher(`${p.q === 0 ? 'Now, some questions. Put up your hand if you know the answer! ' : ''}Question ${p.q + 1}: ${p.lesson.quiz[p.q]!.q.replace('…', 'blank').replace('___', 'blank')}`);
      patch.hand = false;
    }
  }
  // the lesson is over: score it for those who took part
  if (p.phase === 'break' && prev && prev.n === p.n && prev.phase === 'quiz') {
    const answers = s.answers;
    const total = p.lesson.quiz.length;
    if (Object.keys(answers).length && s.slidesSeen >= 2) {
      const correct = p.lesson.quiz.filter((q, i) => answers[i] === q.answer).length;
      patch.result = { n: p.n, correct, total, reward: null };
      if (inRoom) teacher(correct === total ? 'Excellent work, everyone! See you next lesson.' : 'Good job today! Time for a break.');
      track('school_class_done', { lesson: p.lesson.id, correct });
      void reportMinigame('class', { score: correct })
        .then((reward) => {
          const r = useClassroom.getState().result;
          if (r && r.n === p.n) useClassroom.setState({ result: { ...r, reward } });
          void useProfile.getState().refresh();
        })
        .catch(() => undefined);
    }
  }
  useClassroom.setState(patch);
}
