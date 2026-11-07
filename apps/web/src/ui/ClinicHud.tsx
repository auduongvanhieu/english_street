import { useVoice } from '../store/voice';
import { roomName, useClinic } from '../store/clinic';
import { Figure } from './area/activities/Hospital';
import { useT } from '../i18n';

/** A visit to the doctor: reception question, waiting, the doctor's questions, the prescription, the pharmacy. */
export function ClinicHud() {
  const t = useT();
  const stage = useClinic((s) => s.stage);
  const c = useClinic((s) => s.c);
  const options = useClinic((s) => s.options);
  const miss = useClinic((s) => s.miss);
  const xrayStep = useClinic((s) => s.xrayStep);
  const number = useClinic((s) => s.number);
  const room = useClinic((s) => s.room);
  const score = useClinic((s) => s.score);
  const result = useClinic((s) => s.result);
  const k = useClinic.getState();
  if (!stage || !c) return null;
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
  const card = 'pointer-events-auto max-h-[75vh] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  const head = (title: string) => (
    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
      <span className="font-semibold text-gray-800">{title}</span>
      {stage === 'checkin' || stage === 'done' ? (
        <button type="button" onClick={() => k.close()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
          ✕
        </button>
      ) : null}
    </div>
  );
  const choices = (pick: (o: string) => void) => (
    <div className="flex flex-col gap-1.5" dir="ltr">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => pick(o)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${miss === o ? 'border-red-400 bg-red-50 line-through' : 'border-teal-200 bg-teal-50'}`}>
          🗣️ {o}
        </button>
      ))}
    </div>
  );
  // small status pill while waiting (the game goes on)
  if (stage === 'waiting' || stage === 'called')
    return (
      <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-20 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-sm shadow">
        {stage === 'waiting' ? `🎫 ${t('Number {n}. Take a seat and wait to be called.', { n: number })}` : `📢 ${t('Number {n}: go to {room} (the door at the back).', { n: number, room: roomName(room) })}`}
      </div>
    );
  if (stage === 'pharmacy')
    return (
      <div data-ui className={wrap}>
        <div className={card}>
          {head(`💊 ${t('Pharmacy')}`)}
          <div className="mb-2 rounded-lg border border-dashed border-teal-400 bg-teal-50 p-2 text-sm" dir="ltr">
            <b>℞ Prescription</b> — Dr. Chen
            <div>{c.advice}</div>
          </div>
          <p className="mb-1 text-xs text-gray-600">{t('Read the prescription. Which medicine is it for?')}</p>
          <div className="flex flex-col gap-1.5" dir="ltr">
            {options.map((o) => (
              <button key={o} type="button" onClick={() => k.pickMed(o)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${miss === o ? 'border-red-400 bg-red-50 line-through' : 'border-green-200 bg-green-50'}`}>
                💊 {o}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  return (
    <div data-ui className={wrap}>
      <div className={card}>
        {stage === 'checkin' ? (
          <>
            {head(`🏥 ${t('Reception')}`)}
            <p className="mb-1 text-sm" dir="ltr">
              🗣️ “Good morning! What seems to be the problem?”
            </p>
            <p className="mb-2 text-xs text-gray-600">
              {t('How you feel today:')} <span className="text-2xl">{c.face}</span>
            </p>
            {choices((o) => k.checkin(o))}
          </>
        ) : stage === 'talk' ? (
          <>
            {head(`🩺 Dr. Chen`)}
            <p className="mb-2 text-sm" dir="ltr">
              🗣️ “What's the matter?” <span className="text-2xl">{c.face}</span>
            </p>
            {choices((o) => k.tell(o))}
          </>
        ) : stage === 'where' ? (
          <>
            {head(`🩺 Dr. Chen`)}
            <p className="mb-1 text-sm" dir="ltr">
              🗣️ “Where does it hurt? Show me, please.”
            </p>
            <Figure onTap={(id) => k.point(id)} flash={miss ? { id: miss, ok: false } : null} />
          </>
        ) : stage === 'check' ? (
          <>
            {head(`🩺 Dr. Chen`)}
            <p className="mb-2 text-sm" dir="ltr">
              🗣️ “{c.check}”
            </p>
            <button type="button" onClick={() => k.next()} className="min-h-10 w-full rounded-xl bg-teal-600 text-sm font-semibold text-white">
              {t('Continue')}
            </button>
          </>
        ) : stage === 'xray' && c.xray ? (
          <>
            {head(`🩻 ${t('The X-ray room')}`)}
            <p className="mb-1 text-sm" dir="ltr">
              🧑‍⚕️ “{c.xray.orders[xrayStep]}”{' '}
              <button type="button" onClick={() => useVoice.getState().speakAs('radiographer', c.xray!.orders[xrayStep]!, 'en-GB')} className="align-middle text-base" aria-label={t('Listen')}>
                🔊
              </button>
            </p>
            <p className="mb-1 text-xs text-gray-500">{t('Do what the radiographer says ({n}/{total}).', { n: xrayStep + 1, total: c.xray.orders.length })}</p>
            <div className="flex flex-col gap-1.5" dir="ltr">
              {options.map((o) => (
                <button key={o} type="button" onClick={() => k.xrayAct(o)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${miss === o ? 'border-red-300 bg-red-50 line-through' : 'border-gray-200 bg-white'}`}>
                  ✋ {o.replace(/ Click!.*$/, '')}
                </button>
              ))}
            </div>
          </>
        ) : stage === 'xraylook' && c.xray ? (
          <>
            {head(`🩻 ${t('Your X-ray')}`)}
            <div className="mb-2 flex h-28 items-center justify-center rounded-xl bg-slate-900 text-6xl">{c.id === 'wrist' ? '🦴' : '🦶'}</div>
            <p className="mb-1 text-sm" dir="ltr">
              🩺 “What can you see?”
            </p>
            <div className="flex flex-col gap-1.5" dir="ltr">
              {options.map((o) => (
                <button key={o} type="button" onClick={() => k.xrayRead(o)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${miss === o ? 'border-red-300 bg-red-50 line-through' : 'border-gray-200 bg-white'}`}>
                  {o}
                </button>
              ))}
            </div>
          </>
        ) : stage === 'advice' ? (
          <>
            {head(`🩺 Dr. Chen`)}
            <p className="text-sm" dir="ltr">
              🗣️ “{c.diagnosis}”
            </p>
            <div className="my-2 rounded-lg border border-dashed border-teal-400 bg-teal-50 p-2 text-sm" dir="ltr">
              <b>℞ Prescription</b>
              <div>{c.advice}</div>
            </div>
            <button type="button" onClick={() => k.leaveRoom()} className="min-h-10 w-full rounded-xl bg-teal-600 text-sm font-semibold text-white" dir="ltr">
              “Thank you, doctor. Goodbye!”
            </button>
            <p className="mt-1 text-xs text-gray-500">{t('Then take the prescription to the pharmacy.')}</p>
          </>
        ) : stage === 'done' ? (
          <div className="text-center">
            {head(`💊 ${t('Get well soon!')}`)}
            <div className="text-3xl">🩺</div>
            <p className="text-sm">
              {score.talk ? '✅' : '✘'} {t('Told the doctor')} · {score.where ? '✅' : '✘'} {t('Showed where it hurts')} · {score.med ? '✅' : '✘'} {t('Right medicine')}
            </p>
            {result ? <p className="text-sm text-emerald-700">{result.capped ? t('No more rewards for this game today.') : `+${result.xp} XP, +${result.coins} 🪙`}</p> : null}
            <button type="button" onClick={() => k.close()} className="mt-2 min-h-10 w-full rounded-xl bg-teal-600 text-sm font-semibold text-white">
              {t('Done')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
