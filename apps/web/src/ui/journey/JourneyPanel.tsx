import { useEffect, useState } from 'react';
import { AREA_STEPS, DAILY_BONUS, DAILY_POOL, INVITE_REWARD, MAIN_STEPS, STAMP_AREAS, STORY_BONUS, STORY_STEPS, type JourneyStep } from '@es/shared';
import { getPlayerId } from '../../net/player';
import { Panel, DailyContent } from '../ProfilePanels';
import { useJourney } from '../../store/journey';
import { useVoice } from '../../store/voice';
import { tk, useT } from '../../i18n';
import { areaName, stepText } from './journeyText';

/**
 * The Journey book (📋): the main chapters, the area passport with its stamps, today's tasks and the old daily
 * conversation quests. Every unfinished step has "Take me there".
 */
type Tab = 'journey' | 'day' | 'passport' | 'today';

function StepRow({ s, done, progress, current }: { s: JourneyStep; done: boolean; progress?: number; current?: boolean }) {
  const t = useT();
  const tx = stepText(s);
  const tracked = useJourney((x) => x.view?.state.tracked.includes(s.id) ?? false);
  const need = s.goal.count ?? 1;
  return (
    <li className={`rounded-xl border p-3 ${done ? 'border-green-200 bg-green-50' : current ? 'border-amber-300 bg-amber-50 shadow-sm' : 'bg-white'}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-lg">{done ? '✅' : current ? '⭐' : '⬜'}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{tx.title}</div>
          {!done ? <p className="text-sm text-gray-600">{tx.how}</p> : null}
          {!done && tx.say ? (
            <button type="button" onClick={() => useVoice.getState().speakAs('guide', tx.say!, 'en-US')} className="mt-1 rounded-lg bg-white px-2 py-1 text-sm text-blue-800 ring-1 ring-blue-100" dir="ltr">
              🔊 “{tx.say}”
            </button>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-amber-700">
              +{s.reward.xp} XP · +{s.reward.coins} 🪙
            </span>
            {!done && need > 1 ? (
              <span className="text-gray-500">
                {Math.min(progress ?? 0, need)}/{need}
              </span>
            ) : null}
            {!done && s.guide ? (
              <button type="button" onClick={() => useJourney.getState().go(s)} className="min-h-8 rounded-full bg-blue-600 px-3 font-semibold text-white">
                📍 {t('Take me there')}
              </button>
            ) : null}
            {!done && s.kind !== 'main' ? (
              <button type="button" onClick={() => void useJourney.getState().track(s.id, !tracked)} className={`min-h-8 rounded-full px-3 ${tracked ? 'bg-amber-500 text-white' : 'bg-gray-100'}`}>
                {tracked ? `📌 ${t('On my screen')}` : `📌 ${t('Show on my screen')}`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function JourneyPanel() {
  const t = useT();
  const view = useJourney((s) => s.view);
  const [tab, setTab] = useState<Tab>('journey');
  useEffect(() => void useJourney.getState().load(), []);
  const st = view?.state;
  const tabs: [Tab, string][] = [
    ['journey', `⭐ ${t('Journey')}`],
    ['day', `🌅 ${t('My day')}`],
    ['passport', `🛂 ${t('Passport')}`],
    ['today', `📅 ${t('Today')}`],
  ];
  return (
    <Panel title={`📋 ${t('My journey')}`}>
      <div className="mb-3 flex gap-1.5">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-9 flex-1 rounded-full text-sm font-medium ${tab === id ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
            {label}
          </button>
        ))}
      </div>
      {!view || !st ? (
        <p className="text-sm text-gray-500">{t('Loading…')}</p>
      ) : tab === 'journey' ? (
        <>
          <p className="mb-2 text-sm text-gray-600">
            {t('Chapter {n} of {total}', { n: Math.min(view.chapter + 1, MAIN_STEPS.length), total: MAIN_STEPS.length })}
          </p>
          <ol className="space-y-2">
            {MAIN_STEPS.map((s, i) => (i <= view.chapter + 1 || st.done.includes(s.id) ? <StepRow key={s.id} s={s} done={st.done.includes(s.id)} progress={st.prog[s.id]} current={i === view.chapter} /> : null))}
          </ol>
          {view.chapter + 2 < MAIN_STEPS.length ? <p className="mt-2 text-center text-xs text-gray-400">🔒 {t('{n} more chapters to discover', { n: MAIN_STEPS.length - view.chapter - 2 })}</p> : null}
        </>
      ) : tab === 'day' ? (
        <>
          <p className="mb-2 text-sm text-gray-600">{t('A day in English Street: from morning to night, one step after another. New every day. All 8: +{xp} XP, +{coins} coins.', STORY_BONUS)}</p>
          <ol className="space-y-2">
            {STORY_STEPS.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className="w-12 shrink-0 pt-3 text-right font-mono text-xs text-gray-500">{String(s.hour).padStart(2, '0')}:00</span>
                <div className="min-w-0 flex-1">
                  <StepRow s={s} done={i < (st.story ?? 0)} current={i === (st.story ?? 0)} />
                </div>
              </li>
            ))}
          </ol>
          {st.storyBonus ? <p className="mt-2 rounded-lg bg-green-50 p-2 text-center text-sm text-green-800">🌙 {t('What a day! Come back tomorrow for a new one.')}</p> : null}
        </>
      ) : tab === 'passport' ? (
        <>
          <p className="mb-2 text-sm text-gray-600">{t('Finish the 3 tasks of a place to get its stamp. Stamps: {n}/{total}', { n: view.stamps.length, total: STAMP_AREAS.length })}</p>
          <div className="space-y-3">
            {STAMP_AREAS.map((a) => {
              const steps = AREA_STEPS.filter((s) => s.area === a);
              const n = steps.filter((s) => st.done.includes(s.id)).length;
              const stamped = view.stamps.includes(a);
              const an = areaName(a);
              return (
                <details key={a} className={`rounded-xl border ${stamped ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${stamped ? 'bg-green-500 ring-2 ring-green-200' : 'bg-gray-100 grayscale'}`}>{an.icon}</span>
                    <span className="flex-1 font-semibold" dir="ltr">
                      {an.name}
                    </span>
                    <span className="text-sm text-gray-600">{stamped ? `🛂 ${t('Stamped!')}` : `${n}/3`}</span>
                  </summary>
                  <ul className="space-y-2 px-3 pb-3">
                    {steps.map((s) => (
                      <StepRow key={s.id} s={s} done={st.done.includes(s.id)} progress={st.prog[s.id]} />
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-600">{t('Do all 3 tasks today for a bonus: +{xp} XP, +{coins} coins.', DAILY_BONUS)}</p>
          <ul className="space-y-2">
            {st.daily.map((id) => {
              const s = DAILY_POOL.find((x) => x.id === id);
              return s ? <StepRow key={id} s={s} done={st.dailyDone.includes(id)} progress={st.dailyProg[id]} /> : null;
            })}
          </ul>
          {st.dailyBonus ? <p className="mt-2 rounded-lg bg-green-50 p-2 text-center text-sm text-green-800">🎁 {t('All done today! Come back tomorrow for new tasks.')}</p> : null}
          {view.weekly ? <WeeklyCard w={view.weekly} /> : null}
          <InviteCard invited={st.invited ?? 0} />
          <div className="mt-5">
            <DailyContent />
          </div>
        </>
      )}
    </Panel>
  );
}

const WEEKLY_TEXT: Record<string, string> = {
  'w-goals': tk('Score goals in football'),
  'w-quests': tk('Finish conversation quests'),
  'w-fish': tk('Catch fish in the river'),
  'w-books': tk('Read book chapters'),
  'w-dishes': tk('Cook dishes in the kitchen'),
};
function WeeklyCard({ w }: { w: NonNullable<import('@es/shared').JourneyView['weekly']> }) {
  const t = useT();
  const pct = Math.min(100, Math.round((w.count / w.target) * 100));
  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="text-xs font-semibold uppercase text-violet-700">🏆 {t('Weekly challenge · everybody together')}</div>
      <div className="font-semibold">{t(WEEKLY_TEXT[w.id] ?? w.id)}</div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-600">
        <span>
          {w.count}/{w.target}
        </span>
        <span>{w.done ? `✅ ${t('Done! Everybody who helped got the reward.')}` : t('You helped {n} times', { n: w.mine })}</span>
      </div>
    </div>
  );
}

function InviteCard({ invited }: { invited: number }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?invite=${encodeURIComponent(getPlayerId())}`;
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    try {
      if (nav.share) await nav.share({ title: 'English Street', text: t('Come and learn English with me on English Street!'), url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3">
      <div className="text-xs font-semibold uppercase text-sky-700">👋 {t('Invite a friend')}</div>
      <p className="text-sm">{t('Send your link. When your friend finishes chapter 2 of the journey, you get +{xp} XP and +{coins} coins.', INVITE_REWARD)}</p>
      <div className="mt-2 flex gap-2">
        <input readOnly value={link} className="min-w-0 flex-1 rounded-lg border bg-white px-2 text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={t('Invite link')} />
        <button type="button" onClick={() => void share()} className="min-h-9 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white">
          {copied ? `✓ ${t('Copied')}` : t('Share')}
        </button>
      </div>
      {invited ? <p className="mt-1 text-xs text-sky-800">{t('Friends who joined: {n}', { n: invited })}</p> : null}
    </div>
  );
}
