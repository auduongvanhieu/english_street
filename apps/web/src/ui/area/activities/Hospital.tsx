import { useState } from 'react';
import type { AreaContentDto, AreaItemDto } from '@es/shared';
import { useLang, useT } from '../../../i18n';
import { sendAreaQuiz } from '../../../net/api';
import { track } from '../../../net/analytics';
import { useProfile } from '../../../store/profile';
import { say } from '../common';

/**
 * 💊 Pharmacy: a patient describes their symptoms, the learner gives the right medicine from the shelf, then the
 * matching dosage / advice line. 5 patients per round (2 points each). Plus a "body parts" warm-up: the TTS names
 * a part, the learner taps it on a figure (practice only, no reward).
 */
interface Case {
  face: string;
  says: string;
  /** item id of the right medicine; `alsoOk` = other acceptable ones (never offered as wrong options) */
  med: string;
  alsoOk?: string[];
  advice: string;
}
const CASES: Case[] = [
  { face: '😷', says: "I've got a bad cough, and it's worse at night.", med: 'cough-syrup', advice: 'Take two spoons of syrup three times a day, the last one before bed.' },
  { face: '😣', says: 'My throat really hurts when I swallow.', med: 'throat-lozenges', alsoOk: ['cough-syrup'], advice: "Suck one lozenge every three hours. Don't chew it." },
  { face: '🤕', says: "I've had a headache since this morning.", med: 'tablet', advice: 'Take two tablets with water. Wait six hours before you take more.' },
  { face: '🤒', says: 'I feel very hot and I have a temperature of 38.5.', med: 'tablet', alsoOk: ['thermometer'], advice: 'Take two tablets every six hours, rest and drink plenty of water.' },
  { face: '😖', says: "I've got a red, itchy rash on my arm.", med: 'cream', advice: 'Put a little cream on the rash twice a day.' },
  { face: '🦟', says: 'Mosquitoes bit me last night and the bites are really itchy.', med: 'cream', advice: "Put the cream on the bites twice a day, and try not to scratch." },
  { face: '😵', says: 'My eyes are red and itchy. I think it is hay fever.', med: 'eye-drops', advice: 'Put two drops in each eye in the morning and in the evening.' },
  { face: '🙉', says: 'My ear hurts a lot, especially when I lie down.', med: 'ear-drops', advice: 'Put three drops in the ear that hurts, twice a day, for five days.' },
  { face: '🩸', says: 'I cut my finger while I was cooking. It is only a small cut.', med: 'plaster', alsoOk: ['bandage'], advice: 'Wash the cut with clean water and put a plaster on it.' },
  { face: '⚽', says: 'I fell during football and now my ankle is swollen.', med: 'ice-pack', alsoOk: ['bandage'], advice: 'Put the ice pack on your ankle for twenty minutes and keep your foot up.' },
  { face: '🦵', says: 'I hurt my knee last week. It feels weak when I walk.', med: 'bandage', alsoOk: ['ice-pack'], advice: "Wrap the bandage round your knee, but not too tight." },
  { face: '👩‍👦', says: 'My son feels hot. I want to check if he has a fever.', med: 'thermometer', advice: 'Put it under his arm for one minute. Over 38 degrees is a fever.' },
];

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

/** Tap targets on the body figure (viewBox 0 0 200 320), each an item id of the "body" category. */
const PARTS: { id: string; x: number; y: number; r: number }[] = [
  { id: 'head', x: 100, y: 22, r: 18 },
  { id: 'eye', x: 88, y: 48, r: 11 },
  { id: 'ear', x: 64, y: 54, r: 11 },
  { id: 'nose', x: 100, y: 58, r: 10 },
  { id: 'mouth', x: 100, y: 74, r: 10 },
  { id: 'neck', x: 100, y: 96, r: 11 },
  { id: 'arm', x: 48, y: 140, r: 16 },
  { id: 'hand', x: 40, y: 196, r: 14 },
  { id: 'stomach', x: 100, y: 160, r: 20 },
  { id: 'leg', x: 82, y: 236, r: 15 },
  { id: 'knee', x: 118, y: 250, r: 12 },
  { id: 'foot', x: 122, y: 305, r: 14 },
];

function Figure({ onTap, flash }: { onTap: (id: string) => void; flash: { id: string; ok: boolean } | null }) {
  return (
    <svg viewBox="0 0 200 320" className="mx-auto block h-[300px] w-auto touch-manipulation select-none" role="img" aria-label="body">
      {/* simple friendly figure */}
      <circle cx="100" cy="58" r="34" fill="#f2c9a5" stroke="#8a6a50" />
      <path d="M68 40 Q100 4 132 40 Q118 26 100 28 Q82 26 68 40Z" fill="#5a3b25" />
      <ellipse cx="64" cy="58" rx="6" ry="10" fill="#f2c9a5" stroke="#8a6a50" />
      <ellipse cx="136" cy="58" rx="6" ry="10" fill="#f2c9a5" stroke="#8a6a50" />
      <circle cx="88" cy="50" r="4" fill="#2b2b2b" />
      <circle cx="112" cy="50" r="4" fill="#2b2b2b" />
      <path d="M97 56 Q100 66 103 56" fill="none" stroke="#8a6a50" strokeWidth="2" />
      <path d="M90 74 Q100 82 110 74" fill="none" stroke="#b5452f" strokeWidth="3" strokeLinecap="round" />
      <rect x="92" y="90" width="16" height="12" fill="#f2c9a5" />
      <path d="M66 104 Q100 96 134 104 L130 196 L70 196 Z" fill="#4db6ac" stroke="#2e7d72" />
      <path d="M66 106 L42 180" stroke="#4db6ac" strokeWidth="18" strokeLinecap="round" />
      <path d="M134 106 L158 180" stroke="#4db6ac" strokeWidth="18" strokeLinecap="round" />
      <circle cx="40" cy="194" r="11" fill="#f2c9a5" stroke="#8a6a50" />
      <circle cx="160" cy="194" r="11" fill="#f2c9a5" stroke="#8a6a50" />
      <path d="M84 196 L82 296" stroke="#3f51b5" strokeWidth="22" strokeLinecap="round" />
      <path d="M116 196 L118 296" stroke="#3f51b5" strokeWidth="22" strokeLinecap="round" />
      <ellipse cx="78" cy="306" rx="16" ry="8" fill="#5d4037" />
      <ellipse cx="122" cy="306" rx="16" ry="8" fill="#5d4037" />
      {PARTS.map((p) => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={p.r}
          className="cursor-pointer"
          fill={flash?.id === p.id ? (flash.ok ? '#22c55e88' : '#ef444488') : 'transparent'}
          onClick={() => onTap(p.id)}
        />
      ))}
    </svg>
  );
}

function BodyWarmup({ content, onBack }: { content: AreaContentDto; onBack: () => void }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const [order] = useState(() => shuffle(PARTS.map((p) => p.id)).slice(0, 8));
  const [n, setN] = useState(0);
  const [hits, setHits] = useState(0);
  const [miss, setMiss] = useState(false);
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);
  const target = order[n];
  const item = content.items.find((i) => i.id === target);
  const prompt = (id: string) => `Touch your ${content.items.find((i) => i.id === id)?.en ?? id}.`;
  const tap = (id: string) => {
    if (!target) return;
    const ok = id === target;
    setFlash({ id, ok });
    if (!ok) {
      setMiss(true);
      return;
    }
    if (!miss) setHits((h) => h + 1);
    setMiss(false);
    setTimeout(() => {
      setFlash(null);
      setN((k) => k + 1);
      const nx = order[n + 1];
      if (nx) say(prompt(nx));
    }, 600);
  };
  return (
    <div className="space-y-2 py-2 text-center">
      <button type="button" onClick={onBack} className="min-h-11 text-sm text-blue-700">
        ← {t('Back')}
      </button>
      {target ? (
        <>
          <p className="text-sm text-gray-600">{t('Listen and tap the part of the body.')}</p>
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => say(prompt(target))} className="min-h-11 rounded-full bg-teal-600 px-4 text-sm font-semibold text-white">
              🔊 {t('Listen')}
            </button>
            <span className="text-xs text-gray-500">
              {n + 1} / {order.length}
            </span>
          </div>
          {miss && item ? (
            <p className="text-sm" dir="ltr">
              {item.icon} <b>{item.en}</b>
              {!noTr && item.tr.meaning ? <span className="text-gray-500"> · {item.tr.meaning}</span> : null}
            </p>
          ) : null}
          <Figure onTap={tap} flash={flash} />
        </>
      ) : (
        <div className="py-4">
          <div className="text-4xl">🙌</div>
          <p className="font-semibold">{t('{score} / {total} correct', { score: hits, total: order.length })}</p>
          <button type="button" onClick={onBack} className="mt-3 min-h-11 rounded-lg bg-teal-600 px-6 text-sm font-semibold text-white">
            💊 {t('Go to the pharmacy')}
          </button>
        </div>
      )}
    </div>
  );
}

interface Patient {
  c: Case;
  meds: AreaItemDto[];
  advice: string[];
}
function makeRound(content: AreaContentDto): Patient[] {
  const byId = (id: string) => content.items.find((i) => i.id === id);
  const medicines = content.items.filter((i) => i.category === 'medicine' && i.id !== 'prescription');
  const cases = shuffle(CASES.filter((c) => byId(c.med))).slice(0, 5);
  return cases.map((c) => {
    const others = shuffle(medicines.filter((m) => m.id !== c.med && !c.alsoOk?.includes(m.id))).slice(0, 3);
    const wrongAdvice = shuffle(CASES.filter((o) => o.med !== c.med && o.advice !== c.advice)).slice(0, 2).map((o) => o.advice);
    return { c, meds: shuffle([byId(c.med)!, ...others]), advice: shuffle([c.advice, ...wrongAdvice]) };
  });
}

export default function HospitalActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const [mode, setMode] = useState<'menu' | 'body' | 'pharmacy'>('menu');
  const [round, setRound] = useState<Patient[]>([]);
  const [i, setI] = useState(0);
  const [step, setStep] = useState<'med' | 'advice'>('med');
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; xp: number; coins: number } | null>(null);

  const start = () => {
    const r = makeRound(content);
    setRound(r);
    setI(0);
    setStep('med');
    setPicked(null);
    setScore(0);
    setWrong([]);
    setResult(null);
    setMode('pharmacy');
    if (r[0]) say(r[0].c.says);
    track('hospital_pharmacy_start');
  };

  if (mode === 'body') return <BodyWarmup content={content} onBack={() => setMode('menu')} />;

  if (mode === 'menu' || !round.length)
    return (
      <div className="py-4 text-center">
        {result ? (
          <div className="mb-4">
            <div className="text-4xl">{result.correct / result.total >= 0.8 ? '🏆' : '💊'}</div>
            <p className="font-semibold">{t('{score} / {total} correct', { score: result.correct, total: result.total })}</p>
            {result.xp || result.coins ? <p className="text-sm text-emerald-700">+{result.xp} XP{result.coins ? ` · +${result.coins} 🪙` : ''}</p> : null}
            <p className="mt-1 text-sm" dir="ltr">
              “Thank you, doctor! I feel better already.”
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 text-4xl">🧑‍⚕️💊</div>
            <p className="mb-3 text-sm text-gray-600">{t('Patients tell you how they feel. Give each one the right medicine and tell them how to use it.')}</p>
          </>
        )}
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={start} className="min-h-11 w-56 rounded-lg bg-teal-600 px-6 text-sm font-semibold text-white">
            💊 {result ? t('Play again') : t('Open the pharmacy')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('body');
              say('Touch your head.');
            }}
            className="min-h-11 w-56 rounded-lg border border-teal-600 bg-white px-6 text-sm font-semibold text-teal-700"
          >
            🧍 {t('Warm-up: body parts')}
          </button>
        </div>
      </div>
    );

  const p = round[i]!;
  const okMed = (id: string) => id === p.c.med || !!p.c.alsoOk?.includes(id);
  const answered = picked !== null;
  const right = picked !== null && (step === 'med' ? okMed(picked) : picked === p.c.advice);
  const total = round.length * 2;

  const choose = (v: string) => {
    if (answered) return;
    setPicked(v);
    const ok = step === 'med' ? okMed(v) : v === p.c.advice;
    if (ok) setScore((s) => s + 1);
    else setWrong((w) => (step === 'med' && !w.includes(p.c.med) ? [...w, p.c.med] : w));
    if (step === 'advice') say(p.c.advice);
  };

  const finish = async () => {
    let xp = 0;
    let coins = 0;
    try {
      const r = await sendAreaQuiz('hospital', score, total, wrong);
      xp = r.xp;
      coins = r.coins;
      void useProfile.getState().refresh();
    } catch {
      /* offline */
    }
    track('hospital_pharmacy_done', { correct: score, total });
    setResult({ correct: score, total, xp, coins });
    setRound([]);
    setMode('menu');
  };

  const next = () => {
    setPicked(null);
    if (step === 'med') return setStep('advice');
    setStep('med');
    if (i + 1 < round.length) {
      setI(i + 1);
      say(round[i + 1]!.c.says);
    } else void finish();
  };

  const state = (v: string, isRight: boolean) => (!answered ? 'border-gray-300 bg-white hover:bg-gray-50' : isRight ? 'border-green-500 bg-green-50' : v === picked ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white opacity-60');
  const med = content.items.find((x) => x.id === p.c.med);

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t('Patient {n} of {total}', { n: i + 1, total: round.length })}</span>
        <span>
          ⭐ {score} / {total}
        </span>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-teal-50 p-3">
        <span className="text-4xl">{p.c.face}</span>
        <p className="flex-1 text-sm" dir="ltr">
          “{p.c.says}”
        </p>
        <button type="button" onClick={() => say(p.c.says)} className="min-h-11 min-w-11 rounded-full bg-white text-lg shadow" aria-label={t('Listen')}>
          🔊
        </button>
      </div>

      {step === 'med' ? (
        <>
          <p className="text-sm font-semibold">{t('What do you give them?')}</p>
          <div className="grid grid-cols-2 gap-2">
            {p.meds.map((m) => (
              <button key={m.id} type="button" onClick={() => choose(m.id)} className={`min-h-16 rounded-xl border p-2 text-center ${state(m.id, okMed(m.id))}`}>
                <span className="block text-3xl">{m.icon}</span>
                <span className="block text-sm font-semibold" dir="ltr">
                  {m.en}
                </span>
                {!noTr && m.tr.meaning ? <span className="block text-[11px] text-gray-500">{m.tr.meaning}</span> : null}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">
            {med?.icon} {t('How should they use it?')}
          </p>
          <div className="space-y-1.5">
            {p.advice.map((a) => (
              <button key={a} type="button" onClick={() => choose(a)} className={`block min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm ${state(a, a === p.c.advice)}`} dir="ltr">
                {a}
              </button>
            ))}
          </div>
        </>
      )}

      {answered ? (
        <div className={`rounded-lg px-3 py-2 text-sm ${right ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`} dir="ltr">
          {right ? '✅ ' : '❌ '}
          {step === 'med' ? (right ? `Good choice: ${content.items.find((x) => x.id === picked)?.en}.` : `Better: ${med?.icon} ${med?.en}.`) : right ? 'Perfect instructions!' : p.c.advice}
        </div>
      ) : null}
      {answered ? (
        <button type="button" onClick={next} className="min-h-11 w-full rounded-lg bg-teal-600 text-sm font-semibold text-white">
          {step === 'med' ? t('Next question') : i + 1 < round.length ? t('Next patient') : t('Finish')} →
        </button>
      ) : null}
    </div>
  );
}
