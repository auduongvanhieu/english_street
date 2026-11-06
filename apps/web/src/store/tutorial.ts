import { create } from 'zustand';
import { track } from '../net/analytics';
import { localPos } from '../scene/LocalPlayer';
import { cameraOrbit } from '../input/camera';
import { useGame } from './game';

/**
 * First-visit tutorial: a few short steps that finish by themselves when the player does the thing (walk, look
 * around, talk to someone, open the map, chat). "Skip" ends it at any time; Settings can start it again.
 */
export type TutorialStep = 'welcome' | 'move' | 'look' | 'talk' | 'daily' | 'map' | 'chat' | 'done';
export const TUTORIAL_STEPS: TutorialStep[] = ['welcome', 'move', 'look', 'talk', 'daily', 'map', 'chat', 'done'];
export const TUTORIAL_KEY = 'es:tutorial';

interface TutorialStore {
  step: TutorialStep | null;
  /** NPC the arrow points at during the "talk" step */
  target: string | null;
  start: () => void;
  next: () => void;
  skip: () => void;
}

const mark = { x: 0, z: 0, yaw: 0, talked: false, at: 0 };

function nearestNpc(): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const n of useGame.getState().npcs) {
    const d = Math.hypot(n.position[0] - localPos.x, n.position[2] - localPos.z);
    if (d < bd) {
      bd = d;
      best = n.id;
    }
  }
  return best;
}

function enter(step: TutorialStep) {
  mark.x = localPos.x;
  mark.z = localPos.z;
  mark.yaw = cameraOrbit.yaw;
  mark.talked = false;
  mark.at = Date.now();
  useTutorial.setState({ step, target: step === 'talk' ? nearestNpc() : null });
  track('tutorial_step', { step });
}

export const useTutorial = create<TutorialStore>((set, get) => ({
  step: null,
  target: null,
  start() {
    enter('welcome');
  },
  next() {
    const s = get().step;
    if (!s) return;
    const i = TUTORIAL_STEPS.indexOf(s);
    if (i >= TUTORIAL_STEPS.length - 1) {
      localStorage.setItem(TUTORIAL_KEY, 'done');
      set({ step: null, target: null });
      track('tutorial_done');
      return;
    }
    enter(TUTORIAL_STEPS[i + 1]!);
  },
  skip() {
    localStorage.setItem(TUTORIAL_KEY, 'skipped');
    track('tutorial_skip', { step: get().step ?? '' });
    set({ step: null, target: null });
  },
}));

/** Checked a few times a second while the tutorial runs: has the player done this step's thing? */
export function tutorialTick() {
  const t = useTutorial.getState();
  const g = useGame.getState();
  switch (t.step) {
    case 'move':
      if (Math.hypot(localPos.x - mark.x, localPos.z - mark.z) > 4) t.next();
      break;
    case 'look':
      if (Math.abs(cameraOrbit.yaw - mark.yaw) > 0.6) t.next();
      break;
    case 'talk':
      // done once the chat with an NPC was opened and closed again
      if (g.panelNpc) mark.talked = true;
      else if (mark.talked) t.next();
      break;
    case 'daily':
      if (g.uiPanel === 'daily') mark.talked = true;
      else if (mark.talked) t.next();
      break;
    case 'map':
      if (g.uiPanel === 'map') mark.talked = true;
      else if (mark.talked) t.next();
      break;
    case 'chat':
      if (g.chatLog.some((c) => c.from === g.sessionId && c.at >= mark.at)) t.next();
      break;
  }
}

/** New players (never finished or skipped it) get the tutorial once the first panels are closed. */
export const tutorialPending = () => !localStorage.getItem(TUTORIAL_KEY);
