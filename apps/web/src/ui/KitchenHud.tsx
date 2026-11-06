import { RECIPES } from '../world/kitchen';
import { useKitchen } from '../store/kitchen';
import { useVoice } from '../store/voice';
import { useT } from '../i18n';

/** Cooking game card: pick a recipe, then the current English step, the verb choice at a station, the result. */
export function KitchenHud() {
  const t = useT();
  const picking = useKitchen((s) => s.picking);
  const recipe = useKitchen((s) => s.recipe);
  const step = useKitchen((s) => s.step);
  const choosing = useKitchen((s) => s.choosing);
  const choices = useKitchen((s) => s.choices);
  const note = useKitchen((s) => s.note);
  const result = useKitchen((s) => s.result);
  const mistakes = useKitchen((s) => s.mistakes);
  if (!picking && !recipe) return null;
  const k = useKitchen.getState();
  const close = () => k.stop();
  const cur = recipe?.steps[step];
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-gray-800">👩‍🍳 {recipe ? recipe.name : t('Cook a dish')}</span>
          {recipe ? (
            <span>
              {Math.min(step + 1, recipe.steps.length)}/{recipe.steps.length} · ✘ {mistakes}
            </span>
          ) : null}
          <button type="button" onClick={close} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
            ✕
          </button>
        </div>
        {picking && !recipe ? (
          <div className="grid grid-cols-2 gap-1.5" dir="ltr">
            {RECIPES.map((r) => (
              <button key={r.id} type="button" onClick={() => k.start(r.id)} className="min-h-11 rounded-xl border border-orange-200 bg-orange-50 px-2 text-sm">
                {r.name}
              </button>
            ))}
            <p className="col-span-2 mt-1 text-xs text-gray-500">{t('Read each step, walk to the right place in the kitchen and choose the right word.')}</p>
          </div>
        ) : recipe && cur ? (
          <div dir="ltr">
            <button type="button" onClick={() => useVoice.getState().speakAs('chef', cur.text, 'en-US')} className="w-full text-left text-lg font-semibold">
              🔊 {cur.text}
            </button>
            {choosing ? (
              <div className="mt-2 flex gap-1.5">
                {choices.map((v) => (
                  <button key={v} type="button" onClick={() => k.choose(v)} className="min-h-11 flex-1 rounded-xl bg-orange-500 px-1 text-sm font-semibold text-white">
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-500">{t('Walk to the right place in the kitchen and press E / the button.')}</p>
            )}
            {note ? <p className="mt-1 text-sm text-red-600">{note}</p> : null}
          </div>
        ) : recipe ? (
          <div className="text-center" dir="ltr">
            <p className="text-lg font-bold">🍽️ {recipe.name} — ready!</p>
            {result ? (
              <p className="text-sm">
                {result.clean}/{result.total} {t('steps right first time')} · {result.capped ? t('No more rewards for this game today.') : `+${result.xp} XP, +${result.coins} 🪙`}
              </p>
            ) : null}
            <button type="button" onClick={() => k.openRecipes()} className="mt-2 min-h-10 w-full rounded-xl bg-orange-500 text-sm font-semibold text-white">
              {t('Cook another dish')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
