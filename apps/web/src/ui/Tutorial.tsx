import { useEffect } from 'react';
import { useGame } from '../store/game';
import { TUTORIAL_STEPS, tutorialTick, useTutorial, type TutorialStep } from '../store/tutorial';
import { useT } from '../i18n';

/**
 * New-player tutorial card: one short instruction at a time. Steps with an action finish by themselves when the
 * player does it; "Next" moves on anyway; "Skip tutorial" ends it (Settings can show it again).
 */
const ICON: Record<TutorialStep, string> = { welcome: '👋', move: '🚶', look: '👀', talk: '💬', daily: '📋', map: '🗺️', chat: '⌨️', done: '🎉' };

export function Tutorial({ touch }: { touch: boolean }) {
  const t = useT();
  const step = useTutorial((s) => s.step);
  const busy = useGame((s) => !!s.panelNpc || (!!s.uiPanel && s.uiPanel !== 'daily' && s.uiPanel !== 'map'));
  useEffect(() => {
    if (!step) return;
    const id = window.setInterval(tutorialTick, 250);
    return () => window.clearInterval(id);
  }, [step]);
  if (!step || busy) return null;
  const text: Record<TutorialStep, string> = {
    welcome: t('Welcome to English Street! Here you learn English by walking around town and talking to people. This short guide shows you how to play.'),
    move: touch ? t('Move: drag the joystick at the bottom left of the screen. Try walking a few steps.') : t('Move: use the W A S D or arrow keys (hold Shift to run), or click on the ground. Try walking a few steps.'),
    look: touch ? t('Look around: drag on an empty part of the screen to turn the camera.') : t('Look around: drag with the mouse on the screen to turn the camera.'),
    talk: touch
      ? t('Talk to people: walk to the person under the yellow arrow, then tap the yellow 💬 Talk button. Speak or type in English, then close the chat.')
      : t('Talk to people: walk to the person under the yellow arrow and press E. Speak or type in English, then close the chat.'),
    daily: t('Tasks: open 📋 Daily at the top right to see what to do today. Finishing tasks gives you XP and coins.'),
    map: t('Travel: open 🗺️ Map to see the whole town — the zoo, the farm, the hotel, the sports park, the river… Tap a place to go there, or take the bus 🚌.'),
    chat: t('Chat: type a message in English in the box at the bottom and press Enter. Players near you will see it.'),
    done: t("You're ready! Your first task is in the box at the top left — tap 📍 to go there. All tasks are in 📋 My journey. Have fun!"),
  };
  const i = TUTORIAL_STEPS.indexOf(step);
  const auto = step !== 'welcome' && step !== 'done';
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-40 w-[92vw] max-w-sm -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl bg-white p-4 shadow-2xl ring-2 ring-yellow-300">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-gray-700">
            {ICON[step]} {t('Guide')} · {i + 1}/{TUTORIAL_STEPS.length}
          </span>
          {step !== 'done' ? (
            <button type="button" onClick={() => useTutorial.getState().skip()} className="min-h-8 rounded-lg px-2 text-gray-500 hover:bg-gray-100">
              {t('Skip tutorial')}
            </button>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed">{text[step]}</p>
        <div className="mt-3 flex gap-2">
          {step === 'welcome' ? (
            <>
              <button type="button" onClick={() => useTutorial.getState().skip()} className="min-h-10 flex-1 rounded-xl border text-sm">
                {t('I know how to play')}
              </button>
              <button type="button" onClick={() => useTutorial.getState().next()} className="min-h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white">
                {t('Show me')}
              </button>
            </>
          ) : step === 'done' ? (
            <button type="button" onClick={() => useTutorial.getState().next()} className="min-h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white">
              {t('Start playing')}
            </button>
          ) : (
            <button type="button" onClick={() => useTutorial.getState().next()} className="min-h-10 flex-1 rounded-xl border text-sm text-gray-600">
              {auto ? t('Next') : t('Next')} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
