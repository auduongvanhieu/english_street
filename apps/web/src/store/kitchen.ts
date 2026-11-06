import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { RECIPES, STATIONS, type Recipe, type Station } from '../world/kitchen';
import { useGame } from './game';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * The cooking game in the restaurant kitchen: pick a recipe, then follow its English steps — walk to the right
 * station and choose the right verb. Mistakes are counted; the finished dish appears on the pass.
 */
interface KitchenStore {
  recipe: Recipe | null;
  step: number;
  mistakes: number;
  /** steps done right first time */
  clean: number;
  wrongHere: boolean;
  /** the verb choice for the station I am using */
  choosing: Station | null;
  choices: string[];
  note: string | null;
  /** dish on the pass (shown a while after serving) */
  served: string | null;
  result: (MinigameResult & { clean: number; total: number }) | null;
  picking: boolean;
  openRecipes: () => void;
  start: (id: string) => void;
  use: (st: Station) => void;
  choose: (verb: string) => void;
  stop: () => void;
}

const say = (text: string) => useVoice.getState().speakAs('chef', text, 'en-US');
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

export const useKitchen = create<KitchenStore>((set, get) => ({
  recipe: null,
  step: 0,
  mistakes: 0,
  clean: 0,
  wrongHere: false,
  choosing: null,
  choices: [],
  note: null,
  served: null,
  result: null,
  picking: false,
  openRecipes: () => set({ picking: true, result: null, recipe: null, choosing: null, note: null }),
  start(id) {
    const recipe = RECIPES.find((r) => r.id === id) ?? null;
    if (!recipe) return;
    set({ recipe, step: 0, mistakes: 0, clean: 0, wrongHere: false, choosing: null, note: null, picking: false, result: null });
    say(`Let's make ${recipe.name.toLowerCase()}! ${recipe.steps[0]!.text}`);
    track('cooking_start', { recipe: id });
  },
  use(st) {
    const s = get();
    const r = s.recipe;
    if (!r) return;
    const want = r.steps[s.step]!;
    if (want.station !== st) {
      set({ note: `That's the ${STATIONS[st].label.toLowerCase()}. Read the step again!`, mistakes: s.mistakes + 1, wrongHere: true });
      useGame.getState().playEmote('no');
      return;
    }
    set({ choosing: st, choices: shuffle([...want.verbs]), note: null });
  },
  choose(verb) {
    const s = get();
    const r = s.recipe;
    if (!r || !s.choosing) return;
    const want = r.steps[s.step]!;
    if (verb !== want.verbs[0]) {
      set({ note: `Not "${verb}". Read the step again!`, mistakes: s.mistakes + 1, wrongHere: true });
      useGame.getState().playEmote('no');
      return;
    }
    haptic('light');
    useGame.getState().playEmote('yes');
    const clean = s.clean + (s.wrongHere ? 0 : 1);
    const next = s.step + 1;
    if (next >= r.steps.length) {
      set({ choosing: null, step: next, clean, served: r.dish, note: null, wrongHere: false });
      say(clean === r.steps.length ? `Perfect! One ${r.name.toLowerCase()}, ready to serve!` : `Well done! The ${r.name.toLowerCase()} is ready.`);
      const score = Math.round((clean / r.steps.length) * 6);
      reportMinigame('cooking', { score })
        .then((res) => {
          set({ result: { ...res, clean, total: r.steps.length } });
          void useProfile.getState().refresh();
        })
        .catch(() => set({ result: { xp: 0, coins: 0, capped: false, record: false, best: null, left: 0, clean, total: r.steps.length } }));
      track('cooking_done', { recipe: r.id, clean, mistakes: s.mistakes });
      window.setTimeout(() => useKitchen.getState().served === r.dish && set({ served: null }), 60_000);
      return;
    }
    set({ choosing: null, step: next, clean, note: null, wrongHere: false });
    say(r.steps[next]!.text);
  },
  stop() {
    set({ recipe: null, choosing: null, note: null, picking: false, result: null });
  },
}));
