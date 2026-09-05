import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from './supabaseClient';
import { SUBJECT_LABEL } from './constants';
import { groundTruthFor } from './curriculum';

// Cheap + fast model for question generation.
const MODEL = 'claude-haiku-4-5';

// Buffer thresholds - generate when a topic runs low, up to a healthy bank.
const LOW_WATER = 8;   // if a child has fewer than this many unsolved questions…
const GENERATE = 6;    // …ask for this many new ones per call. Small batches finish
                       // well inside the serverless time budget, so a click never hangs;
                       // the background buffer + repeated calls keep the bank growing.

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

interface GenResult { inserted: number; reason?: string }

const QUESTION_TOOL = {
  name: 'emit_questions',
  description: 'החזר את השאלות שנוצרו במבנה מובנה',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['tag', 'stem', 'difficulty', 'hints', 'explanation', 'choices', 'correct_choice_id'],
          properties: {
            tag: { type: 'string' },
            stem: { type: 'string' },
            difficulty: { type: 'integer', minimum: 1, maximum: 5 },
            hints: { type: 'array', items: { type: 'string' } },
            explanation: { type: 'string' },
            correct_choice_id: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
            choices: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'text'],
                properties: {
                  id: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
                  text: { type: 'string' },
                  misconception: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

const VERIFY_TOOL = {
  name: 'emit_verdicts',
  description: 'החזר פסק דין לכל שאלה: תקינה או לסימון לבדיקת הורה',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['verdicts'],
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['index', 'ok'],
          properties: {
            index: { type: 'integer' },
            ok: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
      },
    },
  },
};

interface VerifyItem { stem: string; choices: { id: string; text: string }[]; correct: string }

/**
 * Second-pass check (a different, stricter prompt). Returns a map of index →
 * flag reason for questions that should be held for parent review. On any error
 * it returns an empty map (fail-open: don't block generation).
 */
async function verifyQuestions(apiKey: string, items: VerifyItem[], context: string, rules: string, groundTruth = ''): Promise<Map<number, string>> {
  const flagged = new Map<number, string>();
  if (!items.length) return flagged;
  try {
    const anthropic = new Anthropic({ apiKey, timeout: 40_000, maxRetries: 1 });
    const listing = items.map((q, i) =>
      `#${i} | ${q.stem}\n` + q.choices.map((c) => `  ${c.id}) ${c.text}${c.id === q.correct ? '  ✓' : ''}`).join('\n'),
    ).join('\n\n');
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: `אתה שומר סף פדגוגי קפדן שבודק שאלות לימוד לילדים (${context}). תפקידך למצוא פגמים ולפסול. סמן שאלה כלא‑תקינה (ok=false) אם מתקיים ולו אחד מאלה:
- התשובה המסומנת ✓ שגויה או לא מדויקת עובדתית (100% נכונות נדרשת).
- יש יותר מתשובה נכונה אחת, או שהתשובה משתמעת לשתי פנים.
- טעות עובדתית, ערבוב בין סיפורים/דמויות/אירועים, או ניסוח מבלבל.
- דורשת ידע נדיר או קריאת טקסט ספציפי שילד בגיל הזה לא בהכרח למד.
- הפרה של הכללים הקשיחים לגיל שלהלן (למשל מספרים מחוץ לטווח, גדלים לא סבירים, נושא מעבר לרמת הכיתה).
- (בערבית) התשובה הנכונה אינה מילה בערבית.
הכללים הקשיחים לגיל:
${rules}${groundTruth ? `
מקור אמת לנושא (Ground Truth) - השאלה חייבת להיות עקבית איתו; אם היא סותרת עובדה, חורגת מהתחום, או פורצת את הגבולות שמוגדרים בו, פסול:
${groundTruth}` : ''}
בכל ספק - פסול (ok=false). אחרת ok=true. תן reason קצר וברור בעברית לכל פסילה.`,
      tools: [VERIFY_TOOL],
      tool_choice: { type: 'tool', name: 'emit_verdicts' },
      messages: [{ role: 'user', content: listing }],
    });
    const block = resp.content.find((b) => b.type === 'tool_use');
    const verdicts = block && 'input' in block ? (block.input as { verdicts?: { index: number; ok: boolean; reason?: string }[] }).verdicts : undefined;
    for (const v of verdicts ?? []) {
      if (v && v.ok === false && typeof v.index === 'number') flagged.set(v.index, String(v.reason ?? 'סומן לבדיקה'));
    }
  } catch { /* fail-open */ }
  return flagged;
}

/** Hard, grade-specific guardrails - the "ground truth" the generator must obey
 *  and the validator enforces. Prevents out-of-level content (e.g. millions-scale
 *  numbers or decimals in grade 3) and keeps everyday magnitudes realistic. */
function gradeRules(grade: string): string {
  if (grade === 'grade_3') {
    return `כללים קשיחים לכיתה ג׳ (בני 8-9):
- מספרים עד 10,000 בלבד. אסור מספרים גדולים או מיליונים.
- אסור אחוזים, אסור מספרים עשרוניים, אסור מספרים שליליים, אסור אלגברה.
- שברים רק פשוטים ומוחשיים (חצי, שליש, רבע).
- גדלים מהחיים חייבים להיות סבירים לילדה: מחירים בשקלים בודדים עד מאות (לא אלפים ולא מיליונים), כמויות קטנות.
- ניסוח קצר ופשוט, משפט אחד.`;
  }
  if (grade === 'grade_5') {
    return `כללים קשיחים לכיתה ה׳ (בני 10-11):
- מותר שברים, עשרוני, אחוזים ובעיות רב-שלביות ברמת כיתה ה׳.
- אסור אלגברה של חטיבת ביניים, אסור חזקות/שורשים מתקדמים, אסור מספרים אסטרונומיים.
- גדלים ריאליים: מחירים וכמויות סבירים (לא מיליונים בבעיה יומיומית).`;
  }
  return `כללים למקצועות העשרה (בני 8-11):
- הסבר כל מושג בשפה פשוטה ומוחשית של ילדה, עם דוגמה מהעולם שלה (בית ספר, חברים, משחקים, משפחה).
- בלי ז׳רגון מקצועי, עסקי או אקדמי מורכב. הבן/הרעיון חשוב יותר מהמונח.`;
}

/** Generate fresh questions for one topic, skipping anything already in the bank. */
export async function generateForTopic(topicId: string, count = GENERATE): Promise<GenResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { inserted: 0, reason: 'no-api-key' };
  const sb = getSupabase();
  if (!sb) return { inserted: 0, reason: 'no-db' };

  const { data: topic } = await sb
    .from('curriculum_topics')
    .select('id,grade,subject,sub_topic,arabic_variant')
    .eq('id', topicId).maybeSingle();
  if (!topic) return { inserted: 0, reason: 'no-topic' };

  const { data: existing } = await sb.from('questions_bank').select('payload').eq('topic_id', topicId);
  const existingStems = new Set(
    (existing ?? []).map((r) => norm(String((r.payload as Record<string, unknown>)?.stem ?? ''))),
  );

  const gradeLabel = topic.grade === 'grade_5' ? 'כיתה ה׳' : topic.grade === 'grade_3' ? 'כיתה ג׳' : 'העשרה';
  const subjectLabel = SUBJECT_LABEL[topic.subject] ?? topic.subject;
  const arabicNote = topic.subject === 'arabic'
    ? ` זו ערבית ${topic.arabic_variant === 'msa' ? 'ספרותית (MSA)' : 'מדוברת'}. השאלה מלמדת אוצר מילים בערבית:
נסח כל שאלה בעברית פשוטה ("איך אומרים X בערבית?" / "מה פירוש המילה Y?"). ארבע התשובות חייבות להיות מילים בערבית בתעתיק עברי מנוקד (לא תרגום לעברית!), והתשובה הנכונה היא המילה הערבית הנכונה. אל תיצור שאלה שהתשובה הנכונה בה היא מילה בעברית. ודא שהתעתיק והמשמעות נכונים ותקינים.`
    : '';
  const giftedNote = topic.subject === 'gifted'
    ? ` זהו פריט חשיבה למסלול מחוננים (בסגנון מבחני איתור): צור אנלוגיה מילולית / סדרת מספרים / "יוצא דופן" / חידת היגיון קצרה. נסח את החידה במלואה בגוף השאלה (למשל בסדרה כתוב את כל האיברים והסימן __; באנלוגיה כתוב "א׳ ל-ב׳ כמו ג׳ ל-?"). ודא תשובה אחת נכונה בלבד שנובעת מחוק/יחס עקבי יחיד, ושלושה מסיחים סבירים אך שגויים.`
    : '';

  const gradeAge = topic.grade === 'grade_5' ? 'בני 10-11, כיתה ה׳ - רמה מאתגרת שמתאימה באמת לגיל, לא חומר של כיתות ב׳-ג׳'
    : topic.grade === 'grade_3' ? 'בני 8-9, כיתה ג׳'
    : 'העשרה, בני 8-11';
  // Grade 3 is a beginning reader (Mili) - vocalize everything with nikud.
  const nikudNote = topic.grade === 'grade_3'
    ? `
ניקוד (חשוב מאוד): הקהל הוא קוראת מתחילה בכיתה ג׳. נַקֵּד ניקוד מלא ומדויק את כל הטקסט בעברית - גם השאלה, גם כל ארבע התשובות, גם הרמזים וגם ההסבר. הקפד על ניקוד תקני ונכון לכל מילה. מספרות וסימנים נשארים כרגיל.`
    : '';
  const system = `אתה יוצר שאלות לימוד לילדים בעברית לאפליקציה חינוכית.
קהל היעד: ${gradeAge}. חשוב מאוד: התאם את רמת הקושי לגיל האמיתי - שאלות לכיתה ה׳ צריכות להיות מאתגרות ובעומק המתאים (למשל בעברית: הבחנה בין עובדה לדעה, משמעות בהקשר, מבנה טיעון; בחשבון: שברים, אחוזים, בעיות מילוליות רב-שלביות), לא ידע בסיסי מדי.
כל שאלה: רב-ברירה עם 4 תשובות (מזהים a,b,c,d), בדיוק תשובה נכונה אחת.
difficulty: דרג את קושי השאלה 1-5 ביחס לגיל.
hints: מערך של בדיוק 2 רמזים מדורגים - רמז 1 כיוון עדין, רמז 2 חזק וממוקד יותר. אל תחשוף את התשובה ברמזים.
explanation: משפט קצר שמסביר למה התשובה נכונה.
לפחות מסיח שגוי אחד עם שדה misconception קצר באנגלית.
עברית תקנית וידידותית. בלי אימוגי. גיוון גבוה בין השאלות.
חשוב: השאלה חייבת להיות ניתנת למענה מידע כללי שנלמד בגיל הזה - בלי להניח שקראו טקסט מסוים או פרק ספציפי. הישאר בליבת הנושא הנלמד בבית הספר; הימנע מפרטים נדירים, אזוטריים או מבלבלים (למשל בתנ״ך - רק סיפורים ודמויות מוכרים ומרכזיים, בלי לערבב אירועים או דמויות מסיפורים שונים).
${gradeRules(topic.grade)}
${groundTruthFor(topic.subject, topic.grade) ? `מקור אמת לנושא (הישאר בתוך הגבולות והעובדות האלה בלבד):
${groundTruthFor(topic.subject, topic.grade)}
` : ''}גיוון (חשוב): שנה בין השאלות את המספרים, הערכים וההקשרים - אל תשאל את אותו תרגיל שוב בניסוח אחר (למשל לא לחזור על "25% מתוך 100" עם מילים שונות). כל שאלה צריכה חישוב או תוכן שונה ממש.
עברית ונוסח (חשוב מאוד):
- עברית תקנית, טבעית וברורה. משפט שאלה שלם ומדויק, בלי שגיאות ובלי ניסוח מגושם או מבלבל.
- אל תחשוף את התשובה בתוך השאלה. במיוחד בשאלות אוצר מילים (אנגלית/ערבית): אל תזכיר את המילה הנכונה בגוף השאלה. נסח נקי, למשל "איזו מילה באנגלית מתארת משהו גדול מאוד?" (ולא להזכיר את enormous/huge בשאלה).
- כל ארבעת המסיחים חייבים להיות מאותה קטגוריה והגיוניים כאפשרות, אבל רק אחד נכון באמת.${nikudNote}`;

  const avoid = [...existingStems].slice(0, 40);
  const userMsg = `נושא: ${subjectLabel} - ${topic.sub_topic} (${gradeLabel}).${arabicNote}${giftedNote}
צור ${count} שאלות חדשות ומגוונות ברמה מתאימה.
אל תחזור על השאלות הקיימות (גם לא בניסוח שונה): ${avoid.length ? avoid.map((s) => `"${s}"`).join('; ') : '-'}`;

  let questions: unknown;
  try {
    // Fail cleanly instead of hanging: cap the request time and don't retry so a
    // slow call surfaces a real error to the UI rather than spinning forever.
    const anthropic = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3500,
      system,
      tools: [QUESTION_TOOL],
      tool_choice: { type: 'tool', name: 'emit_questions' },
      messages: [{ role: 'user', content: userMsg }],
    });
    const block = resp.content.find((b) => b.type === 'tool_use');
    questions = block && 'input' in block ? (block.input as { questions?: unknown }).questions : undefined;
  } catch {
    return { inserted: 0, reason: 'api-error' };
  }
  if (!Array.isArray(questions)) return { inserted: 0, reason: 'no-output' };

  type Q = { tag?: string; stem?: string; difficulty?: number; hints?: string[]; explanation?: string; correct_choice_id?: string;
    choices?: { id?: string; text?: string; misconception?: string }[] };
  const rows: Record<string, unknown>[] = [];
  for (const raw of questions as Q[]) {
    if (!raw?.stem || !Array.isArray(raw.choices) || raw.choices.length !== 4) continue;
    const cid = raw.correct_choice_id;
    if (!cid || !['a', 'b', 'c', 'd'].includes(cid)) continue;
    if (!raw.choices.some((c) => c.id === cid && c.text)) continue;
    if (raw.choices.some((c) => !c.id || !c.text)) continue;
    const key = norm(String(raw.stem));
    if (existingStems.has(key)) continue; // dedup vs old bank + this batch
    existingStems.add(key);
    const hints = Array.isArray(raw.hints) ? raw.hints.map(String).filter(Boolean).slice(0, 2) : [];
    const diff = Math.min(5, Math.max(1, Math.round(Number(raw.difficulty ?? 2))));
    rows.push({
      topic_id: topicId, type: 'multiple_choice', difficulty: diff,
      source: 'ai_generated', verification_status: 'auto_passed',
      payload: {
        tag: String(raw.tag ?? ''),
        stem: String(raw.stem),
        hint: hints[0] ?? '',
        hints,
        explanation: raw.explanation ? String(raw.explanation) : undefined,
        choices: raw.choices.map((c) => ({
          id: c.id, text: String(c.text),
          ...(c.misconception ? { misconception: String(c.misconception) } : {}),
        })),
        correct_choice_id: cid,
        coins: topic.grade === 'grade_5' ? 12 : 10,
      },
    });
  }
  if (!rows.length) return { inserted: 0, reason: 'all-duplicates' };

  // Second-pass verification: anything the checker flags is held for parent review.
  const items: VerifyItem[] = rows.map((r) => {
    const p = r.payload as { stem: string; choices: { id: string; text: string }[]; correct_choice_id: string };
    return { stem: p.stem, choices: p.choices, correct: p.correct_choice_id };
  });
  const flagged = await verifyQuestions(apiKey, items, `${subjectLabel} · ${gradeLabel}`, gradeRules(topic.grade), groundTruthFor(topic.subject, topic.grade));
  rows.forEach((r, i) => {
    if (flagged.has(i)) {
      r.verification_status = 'auto_flagged';
      (r.payload as Record<string, unknown>).flag_reason = flagged.get(i);
    }
  });

  const { error } = await sb.from('questions_bank').insert(rows);
  if (error) return { inserted: 0, reason: 'insert-failed' };
  const passed = rows.filter((r) => r.verification_status !== 'auto_flagged').length;
  return { inserted: passed };
}

/**
 * Keep a subject's bank ahead of a child's consumption: for each topic where the
 * child has fewer than LOW_WATER unsolved questions, generate a fresh batch.
 * Self-limiting - stops generating once the buffer is healthy.
 */
export async function ensureBufferForSubject(childId: string, grade: string, subject: string): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 0;
  // Leadership is reflective, hand-authored content (prompt + choices with icons),
  // not multiple-choice - never auto-generate into it.
  if (subject === 'leadership') return 0;
  const sb = getSupabase();
  if (!sb) return 0;
  try {
    const { data: topics } = await sb
      .from('curriculum_topics')
      .select('id')
      .eq('subject', subject)
      .in('grade', [grade, 'enrichment']);
    if (!topics?.length) return 0;

    const { data: solvedRows } = await sb
      .from('attempts_log')
      .select('question_id')
      .eq('user_id', childId)
      .eq('is_correct', true);
    const solved = new Set((solvedRows ?? []).map((r) => r.question_id as string));

    // Find the emptiest topic below the threshold and refill just that one,
    // so a single fired request stays within the serverless time budget.
    let lowestId: string | null = null;
    let lowestCount = LOW_WATER;
    for (const t of topics) {
      const { data: qs } = await sb.from('questions_bank').select('id').eq('topic_id', t.id);
      const unsolved = (qs ?? []).filter((q) => !solved.has(q.id as string)).length;
      if (unsolved < lowestCount) { lowestCount = unsolved; lowestId = t.id as string; }
    }
    if (!lowestId) return 0;
    const r = await generateForTopic(lowestId, GENERATE);
    return r.inserted;
  } catch {
    return 0;
  }
}

// A healthy per-topic bank size. Below this, a topic is "thin" and eligible for
// an automatic top-up. Kept modest so the whole catalogue stays cheap to keep full.
const HEALTHY_BANK = 12;

/** How many topics still have fewer than a healthy bank of questions. Lets the
 *  parent's "fill content" tool show progress and know when it's done. */
export async function thinTopicCount(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  try {
    const { data: topics } = await sb.from('curriculum_topics').select('id,subject');
    if (!topics?.length) return 0;
    const { data: qs } = await sb.from('questions_bank').select('topic_id');
    const count = new Map<string, number>();
    for (const q of qs ?? []) {
      const id = q.topic_id as string;
      count.set(id, (count.get(id) ?? 0) + 1);
    }
    return topics.filter((t) => t.subject !== 'leadership' && (count.get(t.id as string) ?? 0) < HEALTHY_BANK).length;
  } catch {
    return 0;
  }
}

/**
 * Re-check questions already live in the bank against the hardened grade rules,
 * and hide (auto_flag) any that fail - so the app cleans up its own past output.
 * Samples a bounded number of topics per run so cost stays predictable; over
 * several nightly runs it covers the whole bank. Multiple-choice + true/false.
 */
export async function revalidateExisting(maxTopics = 4): Promise<{ checked: number; flagged: number }> {
  const out = { checked: 0, flagged: 0 };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sb = getSupabase();
  if (!apiKey || !sb) return out;
  try {
    const { data: topics } = await sb.from('curriculum_topics').select('id,subject,grade');
    if (!topics?.length) return out;
    const sample = [...topics].sort(() => Math.random() - 0.5).slice(0, maxTopics);
    for (const t of sample) {
      const { data: qs } = await sb.from('questions_bank')
        .select('id,type,payload').eq('topic_id', t.id as string)
        .eq('verification_status', 'auto_passed').limit(12);
      const payloadById = new Map((qs ?? []).map((q) => [q.id as string, q.payload as Record<string, unknown>]));
      const items = (qs ?? [])
        .filter((q) => q.type === 'multiple_choice' || q.type === 'true_false')
        .map((q) => {
          const p = q.payload as { stem?: string; choices?: { id: string; text: string }[]; correct_choice_id?: string; answer?: unknown };
          const choices = q.type === 'true_false'
            ? [{ id: 't', text: 'נכון' }, { id: 'f', text: 'לא נכון' }]
            : (p.choices ?? []);
          const correct = q.type === 'true_false'
            ? (p.answer === true || p.answer === 'true' || p.correct_choice_id === 't' ? 't' : 'f')
            : String(p.correct_choice_id ?? '');
          return { id: q.id as string, stem: String(p.stem ?? ''), choices, correct };
        })
        .filter((i) => i.stem && i.choices.length);
      if (!items.length) continue;
      out.checked += items.length;
      const flagged = await verifyQuestions(
        apiKey,
        items.map((i) => ({ stem: i.stem, choices: i.choices, correct: i.correct })),
        `${SUBJECT_LABEL[t.subject as string] ?? t.subject} · ${t.grade}`,
        gradeRules(t.grade as string),
        groundTruthFor(t.subject as string, t.grade as string),
      );
      for (const [idx, reason] of flagged) {
        const q = items[idx];
        if (!q) continue;
        const payload = { ...(payloadById.get(q.id) ?? {}), flag_reason: reason };
        await sb.from('questions_bank').update({ verification_status: 'auto_flagged', payload }).eq('id', q.id);
        out.flagged += 1;
      }
    }
    return out;
  } catch {
    return out;
  }
}

export interface GlobalRefillResult { scanned: number; filledTopics: number; inserted: number }

/**
 * Background top-up for the whole catalogue: find the thinnest topics and refill
 * a bounded number of them. Runs on a nightly cron so parents never touch it and
 * credit use stays predictable (at most `maxTopics` generations per run).
 */
export async function ensureGlobalBuffer(maxTopics = 4): Promise<GlobalRefillResult> {
  const out: GlobalRefillResult = { scanned: 0, filledTopics: 0, inserted: 0 };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sb = getSupabase();
  if (!apiKey || !sb) return out;
  try {
    const { data: topics } = await sb.from('curriculum_topics').select('id,subject');
    if (!topics?.length) return out;
    out.scanned = topics.length;

    // Count questions per topic in one pass.
    const { data: qs } = await sb.from('questions_bank').select('topic_id');
    const count = new Map<string, number>();
    for (const q of qs ?? []) {
      const id = q.topic_id as string;
      count.set(id, (count.get(id) ?? 0) + 1);
    }

    // Leadership worlds are reflective (1 micro-mission each) - never top them up.
    const thin = topics
      .filter((t) => t.subject !== 'leadership')
      .map((t) => ({ id: t.id as string, n: count.get(t.id as string) ?? 0 }))
      .filter((t) => t.n < HEALTHY_BANK)
      .sort((a, b) => a.n - b.n)
      .slice(0, maxTopics);

    for (const t of thin) {
      const r = await generateForTopic(t.id, GENERATE);
      if (r.inserted > 0) { out.filledTopics += 1; out.inserted += r.inserted; }
    }
    return out;
  } catch {
    return out;
  }
}

export interface TopicGenResult { topic: string; grade: string; inserted: number; reason?: string }

/** Parent-triggered generation for one topic - returns a visible result. */
export async function generateTopicReport(topicId: string): Promise<TopicGenResult> {
  const sb = getSupabase();
  let name = '-', grade = '';
  if (sb) {
    const { data } = await sb.from('curriculum_topics').select('sub_topic,grade').eq('id', topicId).maybeSingle();
    name = (data?.sub_topic as string) ?? '-';
    grade = (data?.grade as string) ?? '';
  }
  const r = await generateForTopic(topicId, GENERATE);
  return { topic: name, grade, inserted: r.inserted, reason: r.reason };
}
