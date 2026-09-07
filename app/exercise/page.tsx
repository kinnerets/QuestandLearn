'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Capi, type CapiMood } from '@/components/Capi';
import { BottomNav } from '@/components/BottomNav';
import { SpeakButton } from '@/components/SpeakButton';
import {
  CoinIcon, FlameIcon, CheckIcon, CloseIcon, HeartIcon, LEAD_ICON, GridIcon, ChevronIcon, StarIcon, MicIcon, BADGE_ICON,
} from '@/components/icons';
import {
  lesson as bundledLesson, PRAISE, GENTLE, HEART, pick,
  type Station, type AcademicStation, type LeadStation,
} from '@/lib/lessonData';
import type { DbStation } from '@/lib/db';
import { mili } from '@/lib/mockData';

type Phase = 'playing' | 'done';

function mapDbLesson(db: DbStation[]): Station[] {
  const n = db.length;
  return db.map((s, i): Station => {
    const position = s.kind === 'lead' ? 'מנהיגות' : `שאלה ${i + 1} מתוך ${n}`;
    if (s.kind === 'lead') {
      return { kind: 'lead', title: s.title, position, subjectLabel: s.subtitle, prompt: s.prompt, note: s.note,
        choices: s.choices, topicId: s.topicId, questionId: s.questionId, coins: 5 };
    }
    return {
      kind: s.kind, title: s.title, position, subjectLabel: s.subtitle, subject: s.subject, tag: s.tag, stem: s.stem,
      qtype: s.qtype,
      choices: s.choices.map((c) => ({ id: c.id, text: c.text, misconception: c.misconception })),
      correctId: s.correctId, correctIds: s.correctIds, answers: s.answers, hint: s.hint, hint2: s.hint2, explanation: s.explanation,
      difficulty: s.difficulty, coins: s.coins,
      questionId: s.questionId, topicId: s.topicId,
    };
  });
}

type NextTopic = { subject: string; label: string; topicId?: string };
type NextInfo = { next: NextTopic | null; done: boolean };

function hrefForNext(n: NextTopic): string {
  return n.subject === 'leadership'
    ? `/exercise?focus=leadership&topic=${n.topicId}`
    : `/exercise?focus=${n.subject}`;
}

/** Loose comparison for typed answers: trim, lowercase, drop nikud, punctuation,
 *  final-letter forms and inner spaces so "42 " / "ארבעים ושתיים" grade fairly. */
function normalizeAnswer(s: string): string {
  return s
    .trim().toLowerCase()
    .replace(/[֑-ׇ]/g, '')       // Hebrew nikud/te'amim
    .replace(/[.,!?;:"'`״׳]/g, '')          // punctuation & Hebrew gershayim
    .replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ')
    .replace(/\s+/g, ' ');
}
function typedMatches(typed: string, answers?: string[]): boolean {
  if (!answers?.length) return false;
  const g = normalizeAnswer(typed);
  if (!g) return false;
  return answers.some((a) => normalizeAnswer(a) === g);
}

/** A short celebratory buzz on a correct answer (no-op where unsupported, e.g.
 *  iOS Safari - harmless). */
function buzz() {
  try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.([18, 40, 22]); } catch { /* ignore */ }
}

/** Speech-to-text language for a subject (only used where the browser supports it). */
function sttLang(subject?: string): string {
  if (subject === 'english') return 'en-US';
  if (subject === 'arabic') return 'ar-SA';
  return 'he-IL';
}

// Remount the whole exercise on a focus/topic change so a client-side navigation
// to "the next topic" re-initialises cleanly (no full page reload).
export default function ExercisePage() {
  return (
    <Suspense fallback={<Loader />}>
      <ExerciseGate />
    </Suspense>
  );
}

function ExerciseGate() {
  const sp = useSearchParams();
  const key = `${sp.get('focus') ?? ''}|${sp.get('topic') ?? ''}|${sp.get('from') ?? ''}`;
  return <ExercisePageInner key={key} />;
}

function ExercisePageInner() {
  const router = useRouter();
  const [backHref, setBackHref] = useState('/'); // where the X returns to (origin screen)
  const [nextInfo, setNextInfo] = useState<NextInfo | null>(null);
  const [journeyNext, setJourneyNext] = useState<NextInfo | null>(null); // prefetched: the next daily topic after this one
  const [newBadges, setNewBadges] = useState<{ key: string; label: string; desc: string }[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSolved, setAllSolved] = useState(false);
  const [coins, setCoins] = useState(mili.quest_coins);
  const [earned, setEarned] = useState(0);
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [results, setResults] = useState<{ stem: string; ok: boolean }[]>([]);

  // Adaptive difficulty: pick the next question near the current level.
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [doneIdx, setDoneIdx] = useState<Set<number>>(new Set());
  const [level, setLevel] = useState(1);
  const [startLevel, setStartLevel] = useState(1);
  const [cleanStreak, setCleanStreak] = useState(0);

  // per-station state
  const [tries, setTries] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState(''); // the fill-in answer being written
  const [picks, setPicks] = useState<string[]>([]); // multi-select: chosen ids
  const [phase, setPhase] = useState<Phase>('playing');
  const [mood, setMood] = useState<CapiMood>('chill');
  const [message, setMessage] = useState<string>('');

  const diffOf = (s: Station) => (s.kind === 'lead' ? 3 : (s.difficulty ?? 2));
  function pickNext(done: Set<number>, target: number): number {
    let best = -1, bestDist = Infinity;
    stations.forEach((s, i) => {
      if (done.has(i)) return;
      const dist = Math.abs(diffOf(s) - target);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }

  // Start near the child's placement level, clamped to what this pool offers.
  useEffect(() => {
    if (stations.length && currentIdx === -1) {
      const minD = Math.min(...stations.map(diffOf));
      const maxD = Math.max(...stations.map(diffOf));
      const target = Math.min(maxD, Math.max(minD, startLevel));
      setLevel(target);
      setCurrentIdx(pickNext(new Set(), target));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations]);

  // Load this session's questions (a focused subject, or the daily journey).
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    const topic = params.get('topic');
    const from = params.get('from');
    // Closing mid-session returns to where the session was opened from.
    setBackHref(from === 'map' ? '/map' : from === 'status' ? '/status' : '/');
    let url = '/api/lesson';
    if (focus) {
      url += `?focus=${encodeURIComponent(focus)}`;
      if (topic) url += `&topic=${encodeURIComponent(topic)}`;
    }
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const lesson = Array.isArray(j?.lesson) ? (j.lesson as DbStation[]) : null;
        if (lesson && lesson.length) setStations(mapDbLesson(lesson));
        else if (focus && lesson && lesson.length === 0) { setAllSolved(true); fireRefill(); } // solved everything → make more
        else setStations(bundledLesson); // mock / no DB
        if (typeof j?.coins === 'number') setCoins(j.coins);
        if (typeof j?.level === 'number') setStartLevel(j.level);
        setLoading(false);
      })
      .catch(() => { if (alive) { setStations(bundledLesson); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  // Prefetch the next daily topic (excluding the one being played) so the last
  // question's button can say "לנושא הבא" and the transition feels continuous.
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (!focus) return;
    let alive = true;
    fetch(`/api/next?exclude=${encodeURIComponent(focus)}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setJourneyNext(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const station = stations[currentIdx];

  function logAttempt(st: AcademicStation, isCorrect: boolean, hintsUsed: number, misconception?: string) {
    if (!st.questionId || !st.topicId) return; // bundled fallback has no ids
    fetch('/api/attempt', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionId: st.questionId, topicId: st.topicId,
        isCorrect, hintsUsed, misconception: misconception ?? null,
      }),
    }).catch(() => {});
  }

  function resetStation() {
    setTries(0); setChosenId(null); setWrongIds([]); setEliminated([]); setRevealed(false);
    setTyped(''); setPicks([]); setPhase('playing'); setMood('chill'); setMessage('');
  }

  // Ask the server to top up this subject's question bank (fire-and-forget).
  function fireRefill() {
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (!focus) return;
    fetch('/api/refill', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: focus }), keepalive: true,
    }).catch(() => {});
  }

  function next() {
    const done = new Set(doneIdx);
    done.add(currentIdx);
    if (done.size >= stations.length) {
      setFinished(true);
      (async () => {
        let badges: { key: string; label: string; desc: string }[] = [];
        try {
          const r = await fetch('/api/quest/complete', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ coins: earned, xp: correct * 10 }),
          });
          const j = await r.json();
          if (j?.newBadges?.length) badges = j.newBadges;
        } catch { /* ignore */ }
        fireRefill();
        router.refresh(); // invalidate the home cache so "done" syncs immediately
        let ni: NextInfo = { next: null, done: true };
        try { ni = await (await fetch('/api/next')).json(); } catch { /* ignore */ }
        // Part of the daily journey and no badge to celebrate → glide straight
        // into the next topic (no ending screen between topics). But if the child
        // picked this subject from the map, don't drag her into the journey.
        const fromMap = backHref !== '/';
        if (ni.next && !badges.length && !fromMap) { router.push(hrefForNext(ni.next)); return; }
        setNewBadges(badges);
        setNextInfo(ni);
      })();
      return;
    }
    setDoneIdx(done);
    setCurrentIdx(pickNext(done, level)); // level already reflects the last outcome
    resetStation();
  }

  function answer(st: AcademicStation, choiceId: string) {
    if (phase === 'done') return;
    if (choiceId === st.correctId) {
      buzz();
      setChosenId(choiceId);
      setCoins((c) => c + st.coins);
      setEarned((e) => e + st.coins);
      setCorrect((n) => n + 1);
      setAnswered((n) => n + 1);
      setMood('cheer');
      setMessage(`${pick(PRAISE)} +${st.coins} מטבעות.`);
      setPhase('done');
      setResults((r) => [...r, { stem: st.stem, ok: true }]);
      logAttempt(st, true, tries);
      // Adaptive: a clean first-try correct builds a streak → step difficulty up.
      if (tries === 0) {
        setCleanStreak((s) => { const ns = s + 1; if (ns >= 2) { setLevel((l) => Math.min(5, l + 1)); return 0; } return ns; });
      } else setCleanStreak(0);
    } else {
      const t = tries + 1;
      setTries(t);
      setWrongIds((w) => [...w, choiceId]);
      if (t === 1) {
        // Hint 1 - a gentle direction.
        setMood('hint');
        setMessage('כיוון: ' + st.hint);
      } else if (t === 2) {
        // Hint 2 - narrow the field: remove one more wrong option, plus a stronger hint.
        const gone = st.choices.find((c) => c.id !== st.correctId && c.id !== choiceId
          && !eliminated.includes(c.id) && !wrongIds.includes(c.id));
        if (gone) setEliminated((e) => [...e, gone.id]);
        setMood('hint');
        setMessage(st.hint2 ? ('רמז נוסף: ' + st.hint2) : 'כמעט! הורדתי אפשרות שגויה - ננסה שוב.');
      } else {
        // Reveal - the answer with an explanation. No punishment.
        setRevealed(true);
        setAnswered((n) => n + 1);
        setMood('chill');
        setCleanStreak(0);
        setLevel((l) => Math.max(1, l - 1)); // struggled → ease difficulty down
        const mis = st.choices.find((c) => c.id === choiceId)?.misconception;
        setMessage(pick(GENTLE) + (st.explanation ? ' ' + st.explanation : ''));
        setPhase('done');
        setResults((r) => [...r, { stem: st.stem, ok: false }]);
        logAttempt(st, false, 2, mis);
      }
    }
  }

  function submitTyped(st: AcademicStation) {
    if (phase === 'done') return;
    if (typedMatches(typed, st.answers)) {
      buzz();
      setCoins((c) => c + st.coins);
      setEarned((e) => e + st.coins);
      setCorrect((n) => n + 1);
      setAnswered((n) => n + 1);
      setMood('cheer');
      setMessage(`${pick(PRAISE)} +${st.coins} מטבעות.`);
      setPhase('done');
      setRevealed(true);
      setResults((r) => [...r, { stem: st.stem, ok: true }]);
      logAttempt(st, true, tries);
      if (tries === 0) {
        setCleanStreak((s) => { const ns = s + 1; if (ns >= 2) { setLevel((l) => Math.min(5, l + 1)); return 0; } return ns; });
      } else setCleanStreak(0);
    } else {
      const t = tries + 1;
      setTries(t);
      if (t === 1) { setMood('hint'); setMessage('כיוון: ' + st.hint); }
      else if (t === 2) { setMood('hint'); setMessage(st.hint2 ? ('רמז נוסף: ' + st.hint2) : 'כמעט! בדקי שוב את הכתיב.'); }
      else {
        // Reveal the accepted answer, no punishment.
        setRevealed(true);
        setAnswered((n) => n + 1);
        setMood('chill');
        setCleanStreak(0);
        setLevel((l) => Math.max(1, l - 1));
        const ans = st.answers?.[0] ?? '';
        setMessage(`${pick(GENTLE)} התשובה: ${ans}${st.explanation ? ' - ' + st.explanation : ''}`);
        setPhase('done');
        setResults((r) => [...r, { stem: st.stem, ok: false }]);
        logAttempt(st, false, 2);
      }
    }
  }

  function submitMulti(st: AcademicStation) {
    if (phase === 'done') return;
    const correct = new Set(st.correctIds ?? []);
    const chosen = new Set(picks);
    const exact = correct.size > 0 && correct.size === chosen.size && [...correct].every((id) => chosen.has(id));
    if (exact) {
      buzz();
      setCoins((c) => c + st.coins);
      setEarned((e) => e + st.coins);
      setCorrect((n) => n + 1);
      setAnswered((n) => n + 1);
      setMood('cheer');
      setRevealed(true);
      setMessage(`${pick(PRAISE)} +${st.coins} מטבעות.`);
      setPhase('done');
      setResults((r) => [...r, { stem: st.stem, ok: true }]);
      logAttempt(st, true, tries);
      if (tries === 0) {
        setCleanStreak((s) => { const ns = s + 1; if (ns >= 2) { setLevel((l) => Math.min(5, l + 1)); return 0; } return ns; });
      } else setCleanStreak(0);
    } else {
      const t = tries + 1;
      setTries(t);
      if (t === 1) { setMood('hint'); setMessage('כמעט! בחרי את כל התשובות הנכונות (יש יותר מאחת). כיוון: ' + st.hint); }
      else if (t === 2) { setMood('hint'); setMessage(st.hint2 ? ('רמז נוסף: ' + st.hint2) : 'בדקי שוב - חלק מהסימונים לא מדויקים.'); }
      else {
        setRevealed(true);
        setAnswered((n) => n + 1);
        setMood('chill');
        setCleanStreak(0);
        setLevel((l) => Math.max(1, l - 1));
        setMessage(pick(GENTLE) + (st.explanation ? ' ' + st.explanation : ' סימנתי את התשובות הנכונות.'));
        setPhase('done');
        setResults((r) => [...r, { stem: st.stem, ok: false }]);
        logAttempt(st, false, 2);
      }
    }
  }

  function chooseLead(id: string) {
    if (phase === 'done') return;
    const st = station as LeadStation;
    buzz();
    setChosenId(id);
    setMood('cheer');
    const reward = st.coins ?? 5;               // a small fixed reward - reflective, never scored
    setCoins((c) => c + reward);
    setEarned((e) => e + reward);
    setMessage(`${pick(HEART)} +${reward} מטבעות.`);
    setPhase('done');
    // Record the deposit (counts leadership engagement, excluded from accuracy).
    if (st.topicId && st.questionId) {
      fetch('/api/compass/deposit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicId: st.topicId, questionId: st.questionId, choice: { choice: id } }),
      }).catch(() => {});
    }
  }

  if (loading) return <Loader />;
  if (allSolved) return <SubjectDone />;
  if (finished) {
    // While settling up (or gliding into the next topic) we show the loader.
    if (nextInfo === null) return <Loader />;
    if (newBadges.length) return <BadgeCelebration badges={newBadges} next={nextInfo.next} />;
    // A next daily topic is handled by direct navigation in next(); reaching here
    // means the journey is done → celebrate.
    return <Celebration earned={earned} correct={correct} answered={answered} results={results} xp={correct * 10} />;
  }
  if (!station) return <Loader />;

  return (
    <main className="app-shell">
      <div className="ex-bar">
        <Link href={backHref} className="ex-back" aria-label="חזרה"><CloseIcon /></Link>
        <div className="ex-progress">
          {stations.map((_, i) => (
            <span key={i} className={`pip${doneIdx.has(i) ? ' fill' : ''}${i === currentIdx ? ' cur' : ''}`} />
          ))}
        </div>
        <div className="ex-coins"><CoinIcon /><span>{coins}</span></div>
      </div>

      <div className="screen-body ex-body">
        <div className="ex-head">
          {station.subjectLabel && <span className="ex-subject">{station.subjectLabel}</span>}
          <span className="ex-title">{station.title}</span>
          <span className="ex-pos">
            {station.kind === 'lead' ? station.position : `שאלה ${doneIdx.size + 1} מתוך ${stations.length}`}
          </span>
        </div>

        {station.kind === 'lead'
          ? <LeadView st={station} picked={chosenId} onPick={chooseLead} />
          : station.qtype === 'type_in'
            ? <TypeInView st={station} value={typed} onChange={setTyped}
                revealed={revealed} locked={phase === 'done'} onSubmit={() => submitTyped(station)} />
            : station.qtype === 'multi_select'
              ? <MultiSelectView st={station} picks={picks} onToggle={(id) =>
                    setPicks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
                  revealed={revealed} locked={phase === 'done'} onSubmit={() => submitMulti(station)} />
              : <AcademicView st={station} chosenId={chosenId} wrongIds={wrongIds} eliminated={eliminated}
                  revealed={revealed} locked={phase === 'done'} onAnswer={(id) => answer(station, id)} />}

        {message && (
          <div className="capi-row" style={{ marginTop: 14 }}>
            <Capi mood={mood} size={70} />
            <div className="bubble" dangerouslySetInnerHTML={{ __html: message }} />
          </div>
        )}

        <div className="foot">
          {phase === 'done' && (
            <button className="cta" onClick={next}>
              {doneIdx.size + 1 >= stations.length
                ? (journeyNext?.next ? `לנושא הבא: ${journeyNext.next.label}` : 'סיום')
                : 'ממשיכים'}
              {doneIdx.size + 1 >= stations.length && journeyNext?.next && (
                <span className="cta-ico"><ChevronIcon /></span>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Loader() {
  return (
    <main className="app-shell">
      <div className="screen-body loader">
        <Capi mood="chill" size={92} />
        <div className="loader-dots"><i /><i /><i /></div>
        <p>מכינות לך תרגול…</p>
      </div>
    </main>
  );
}

function AcademicView({
  st, chosenId, wrongIds, eliminated, revealed, locked, onAnswer,
}: {
  st: AcademicStation; chosenId: string | null; wrongIds: string[]; eliminated: string[];
  revealed: boolean; locked: boolean; onAnswer: (id: string) => void;
}) {
  return (
    <>
      <div className="qcard">
        <div className="qcard-top">
          <div className="qtag">{st.tag}</div>
          <SpeakButton text={`${st.stem}. ${st.choices.map((c) => c.text).join('. ')}`} />
        </div>
        <div className="qtext">{st.stem}</div>
      </div>
      <div className={`answers${st.qtype === 'true_false' ? ' tf' : ''}`}>
        {st.choices.map((c) => {
          const isCorrectPick = chosenId === c.id && c.id === st.correctId;
          const isWrong = wrongIds.includes(c.id);
          const isGone = eliminated.includes(c.id);
          const showCorrect = isCorrectPick || (revealed && c.id === st.correctId);
          const cls = `ans${showCorrect ? ' correct' : ''}${isWrong ? ' wrong' : ''}${isGone ? ' gone' : ''}`;
          const disabled = locked || isWrong || isGone;
          return (
            <div key={c.id} className="ans-row">
              <button className={cls} onClick={() => onAnswer(c.id)} disabled={disabled}>
                <span>{c.text}</span>
                {showCorrect && <CheckIcon />}
                {isWrong && <CloseIcon />}
              </button>
              {st.qtype !== 'true_false' && <SpeakButton text={c.text} className="ans-speak" />}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Multi-select: several answers are correct; the child ticks all of them and
 *  taps "בדיקה". A bold banner makes the "choose all correct" rule unmissable. */
function MultiSelectView({
  st, picks, onToggle, revealed, locked, onSubmit,
}: {
  st: AcademicStation; picks: string[]; onToggle: (id: string) => void;
  revealed: boolean; locked: boolean; onSubmit: () => void;
}) {
  const correct = new Set(st.correctIds ?? []);
  const n = correct.size;
  return (
    <>
      <div className="qcard">
        <div className="qcard-top">
          <div className="qtag">{st.tag}</div>
          <SpeakButton text={`${st.stem}. ${st.choices.map((c) => c.text).join('. ')}`} />
        </div>
        <div className="qtext">{st.stem}</div>
      </div>
      <div className="ms-note">בחרי בכל התשובות הנכונות{n ? ` (יש ${n})` : ' (יש יותר מאחת)'}</div>
      <div className="answers ms">
        {st.choices.map((c) => {
          const on = picks.includes(c.id);
          const isCorrect = revealed && correct.has(c.id);
          const isWrongPick = revealed && on && !correct.has(c.id);
          const cls = `ans ms-ans${on ? ' on' : ''}${isCorrect ? ' correct' : ''}${isWrongPick ? ' wrong' : ''}`;
          return (
            <div key={c.id} className="ans-row">
              <button className={cls} onClick={() => onToggle(c.id)} disabled={locked}>
                <span className={`ms-box${on ? ' on' : ''}`}>{on && <CheckIcon />}</span>
                <span>{c.text}</span>
                {isCorrect && <CheckIcon />}
                {isWrongPick && <CloseIcon />}
              </button>
              <SpeakButton text={c.text} className="ans-speak" />
            </div>
          );
        })}
      </div>
      {!locked && (
        <button className="cta typein-check" onClick={onSubmit} disabled={!picks.length}>בדיקה</button>
      )}
    </>
  );
}

/** A fill-in question: the child types (or dictates) the answer and taps "בדיקה". */
function TypeInView({
  st, value, onChange, revealed, locked, onSubmit,
}: {
  st: AcademicStation; value: string; onChange: (v: string) => void;
  revealed: boolean; locked: boolean; onSubmit: () => void;
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  // Speech recognition exists on Chrome/Android; on iOS Safari it doesn't, so
  // the mic button simply isn't shown there.
  const SR = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition ?? null;
  }, []);

  function dictate() {
    if (!SR || locked) return;
    if (listening) { recRef.current?.stop(); return; }
    try {
      const rec = new (SR as new () => {
        lang: string; interimResults: boolean; maxAlternatives: number;
        onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
        onend: () => void; onerror: () => void; start: () => void; stop: () => void;
      })();
      rec.lang = sttLang(st.subject);
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => onChange(e.results[0][0].transcript);
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch { setListening(false); }
  }

  return (
    <>
      <div className="qcard">
        <div className="qcard-top">
          <div className="qtag">{st.tag}</div>
          <SpeakButton text={st.stem} />
        </div>
        <div className="qtext">{st.stem}</div>
      </div>
      <div className="typein">
        <div className="typein-field">
          <input
            className="typein-input" value={value} disabled={locked}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && value.trim() && !locked) onSubmit(); }}
            placeholder="כתבי או הקליטי את התשובה…" autoComplete="off" inputMode="text"
          />
          {SR && !locked && (
            <button type="button" className={`mic-btn${listening ? ' on' : ''}`} onClick={dictate}
              aria-label={listening ? 'עצירת הקלטה' : 'דיבור'}><MicIcon /></button>
          )}
        </div>
        {revealed && st.answers?.[0] && (
          <div className="typein-answer"><CheckIcon /> {st.answers[0]}</div>
        )}
        {!locked && (
          <button className="cta typein-check" onClick={onSubmit} disabled={!value.trim()}>בדיקה</button>
        )}
      </div>
    </>
  );
}

function LeadView({
  st, picked, onPick,
}: {
  st: LeadStation; picked: string | null; onPick: (id: string) => void;
}) {
  return (
    <>
      <div className="qcard">
        <div className="qcard-top">
          <div className="qtag"><HeartIcon /> רגע של מנהיגות</div>
          <SpeakButton text={`${st.prompt}. ${st.note ?? ''}. ${(st.choices ?? []).map((c) => c.label).join('. ')}`} />
        </div>
        <div className="qtext" style={{ fontSize: '1.12rem' }}>{st.prompt}</div>
        <div className="qnote">{st.note}</div>
      </div>
      <div className="choices">
        {(st.choices ?? []).map((c) => {
          const Icon = LEAD_ICON[c.icon] ?? StarIcon;
          return (
            <button key={c.id} className={`choice${picked === c.id ? ' picked' : ''}`} onClick={() => onPick(c.id)}>
              <span className="choice-ico"><Icon /></span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.6 + Math.random() * 1.8,
      color: ['#FF2A85', '#FACC15', '#38BDF8', '#2FBF8F', '#C49A6C'][i % 5],
    })),
    [],
  );
  return (
    <div className="confetti">
      {bits.map((c, i) => (
        <i key={i} style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }} />
      ))}
    </div>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const c = 2 * Math.PI * 32;
  const offset = c * (1 - pct / 100);
  const tier = pct >= 70 ? '#2FBF8F' : pct >= 40 ? '#FACC15' : '#FF2A85';
  return (
    <div className="score-ring">
      <svg width={92} height={92} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="32" fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="40" cy="40" r="32" fill="none" stroke={tier} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 40 40)" />
      </svg>
      <span>{pct}%</span>
    </div>
  );
}

function Celebration({ earned, correct, answered, results = [] }: { earned: number; correct: number; answered: number; xp?: number; results?: { stem: string; ok: boolean }[] }) {
  const pct = answered ? Math.round((correct / answered) * 100) : 100;
  return (
    <main className="app-shell">
      <div className="screen-body cele">
        <Confetti />
        <div className="wow">וואו!</div>
        <Capi mood="cheer" size={120} />
        <h2>סיימת את הנושא!</h2>
        {answered > 0 && (
          <>
            <ScoreRing pct={pct} />
            <p className="cele-score">ענית נכון על {correct} מתוך {answered}</p>
          </>
        )}
        {results.length > 0 && (
          <div className="cele-summary">
            <div className="cele-summary-title">סיכום התרגול</div>
            {results.map((r, i) => (
              <div key={i} className={`cele-sum-row${r.ok ? ' ok' : ' no'}`}>
                <span className="cele-sum-ico">{r.ok ? <CheckIcon /> : <CloseIcon />}</span>
                <span className="cele-sum-stem">{r.stem}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rewardrow">
          <div className="rw"><b><CoinIcon /> +{earned}</b><span>מטבעות</span></div>
          <div className="rw"><b><FlameIcon /></b><span>שמרת על הרצף</span></div>
        </div>
        <NextCTA />
      </div>
      <BottomNav active="/" />
    </main>
  );
}

/** After a session: go straight to the next unfinished daily topic; only when the
 *  whole daily journey is done, offer "all topics". Keeps the flow moving. */
function NextCTA() {
  const [state, setState] = useState<{ next: { subject: string; label: string; topicId?: string } | null; done: boolean } | null>(null);
  useEffect(() => {
    fetch('/api/next').then((r) => r.json()).then(setState).catch(() => setState({ next: null, done: true }));
  }, []);
  if (!state) return null;
  if (state.next) {
    const n = state.next;
    return (
      <div className="cele-actions">
        <Link href={hrefForNext(n)} className="cta">לנושא הבא: {n.label} <span className="cta-ico"><ChevronIcon /></span></Link>
        <Link href="/" className="cta ghost">חזרה למסע</Link>
      </div>
    );
  }
  return (
    <div className="cele-actions">
      <div className="cele-done-msg">סיימת את כל המסע היומי!</div>
      <Link href="/map" className="cta"><span className="cta-ico"><GridIcon /></span> לכל הנושאים</Link>
      <Link href="/" className="cta ghost">חזרה הביתה</Link>
    </div>
  );
}

/** A new badge was just earned - celebrate it in the moment, then let her continue. */
function BadgeCelebration({ badges, next }: {
  badges: { key: string; label: string; desc: string }[];
  next: NextTopic | null;
}) {
  const href = next ? hrefForNext(next) : null;
  return (
    <main className="app-shell">
      <div className="screen-body cele">
        <Confetti />
        <div className="wow">תג חדש!</div>
        <Capi mood="cheer" size={110} />
        <div className="badge-pop-list">
          {badges.map((b) => {
            const Icon = BADGE_ICON[b.key] ?? StarIcon;
            return (
              <div key={b.key} className="badge-pop">
                <span className="badge-pop-ico"><Icon /></span>
                <span className="badge-pop-txt"><b>{b.label}</b><small>{b.desc}</small></span>
              </div>
            );
          })}
        </div>
        <div className="cele-actions">
          {href
            ? <Link href={href} className="cta">לנושא הבא: {next!.label} <span className="cta-ico"><ChevronIcon /></span></Link>
            : <Link href="/map" className="cta"><span className="cta-ico"><GridIcon /></span> לכל הנושאים</Link>}
          <Link href="/" className="cta ghost">חזרה למסע</Link>
        </div>
      </div>
    </main>
  );
}

function SubjectDone() {
  return (
    <main className="app-shell">
      <div className="screen-body cele">
        <Confetti />
        <div className="wow">כל הכבוד!</div>
        <Capi mood="cheer" size={120} />
        <h2>סיימת את השאלות כאן</h2>
        <NextCTA />
      </div>
      <BottomNav active="/" />
    </main>
  );
}
