import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from './supabaseClient';
import { SUBJECT_LABEL } from './constants';
import { groundTruthFor } from './curriculum';
import type { DiagramSpec } from './types';

// Cheap + fast model for question generation.
const MODEL = 'claude-haiku-4-5';

// Buffer thresholds - generate when a topic runs low, up to a healthy bank.
const LOW_WATER = 8;   // if a child has fewer than this many unsolved questions…
const GENERATE = 6;    // …ask for this many new ones per call. Small batches finish
                       // well inside the serverless time budget, so a click never hangs;
                       // the background buffer + repeated calls keep the bank growing.

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Validate a model-provided diagram spec; return a clean spec or undefined so a
 *  malformed illustration is simply dropped (the question still works). */
function validateDiagram(d: unknown): DiagramSpec | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const o = d as Record<string, unknown>;
  const kinds = ['rect', 'square', 'triangle', 'circle', 'shapes'];
  if (typeof o.kind !== 'string' || !kinds.includes(o.kind)) return undefined;
  const pos = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : undefined);
  const out: DiagramSpec = { kind: o.kind as DiagramSpec['kind'] };
  if (typeof o.unit === 'string') out.unit = o.unit.slice(0, 6);
  if (o.kind === 'rect') { out.w = pos(o.w); out.h = pos(o.h); if (!out.w || !out.h) return undefined; }
  else if (o.kind === 'square') { out.s = pos(o.s) ?? pos(o.w); if (!out.s) return undefined; }
  else if (o.kind === 'triangle') { out.base = pos(o.base); out.height = pos(o.height); if (!out.base || !out.height) return undefined; }
  else if (o.kind === 'circle') { out.r = pos(o.r); if (!out.r) return undefined; }
  else {
    const shapes = ['circle', 'square', 'triangle', 'star'];
    const items = Array.isArray(o.items) ? o.items : [];
    out.items = items.slice(0, 6).map((it) => {
      const r = (it ?? {}) as Record<string, unknown>;
      return {
        shape: (typeof r.shape === 'string' && shapes.includes(r.shape) ? r.shape : 'circle') as 'circle',
        ...(typeof r.color === 'string' ? { color: r.color } : {}),
      };
    });
    if (!out.items.length) return undefined;
  }
  return out;
}

interface GenResult { inserted: number; reason?: string }

const QUESTION_TOOL = {
  name: 'emit_questions',
  description: 'החזר את השאלות שנוצרו במבנה מובנה, מגוון סוגים',
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
          required: ['tag', 'qtype', 'stem', 'difficulty', 'hints', 'explanation'],
          properties: {
            tag: { type: 'string' },
            qtype: { type: 'string', enum: ['multiple_choice', 'multi_select', 'true_false', 'type_in'] },
            stem: { type: 'string' },
            difficulty: { type: 'integer', minimum: 1, maximum: 5 },
            hints: { type: 'array', items: { type: 'string' } },
            explanation: { type: 'string' },
            // multiple_choice: exactly one correct id
            correct_choice_id: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
            // multi_select: two or more correct ids
            correct_choice_ids: { type: 'array', items: { type: 'string', enum: ['a', 'b', 'c', 'd'] } },
            // true_false: the correct verdict
            answer_bool: { type: 'boolean' },
            // type_in: accepted written answers (short)
            answers: { type: 'array', items: { type: 'string' } },
            // optional illustration (geometry shapes / reasoning shape rows)
            diagram: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', enum: ['rect', 'square', 'triangle', 'circle', 'shapes'] },
                w: { type: 'number' }, h: { type: 'number' }, s: { type: 'number' },
                base: { type: 'number' }, height: { type: 'number' }, r: { type: 'number' },
                unit: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object', additionalProperties: false,
                    properties: {
                      shape: { type: 'string', enum: ['circle', 'square', 'triangle', 'star'] },
                      color: { type: 'string' },
                    },
                  },
                },
              },
            },
            // choices for multiple_choice / multi_select (4 options)
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

interface VerifyItem {
  stem: string;
  qtype?: string;
  choices?: { id: string; text: string }[];
  correct?: string;         // multiple_choice / true_false: the single correct id
  correctIds?: string[];    // multi_select: all correct ids
  answers?: string[];       // type_in: accepted answers
}

/** Render one item for the checker, marking the correct answer(s) per type. */
function verifyListing(q: VerifyItem): string {
  if (q.qtype === 'type_in') {
    return `  (השלמה) תשובות מתקבלות: ${(q.answers ?? []).join(' ; ')}`;
  }
  if (q.qtype === 'true_false') {
    return `  (נכון/לא נכון) התשובה הנכונה: ${q.correct === 't' ? 'נכון' : 'לא נכון'}`;
  }
  const correctSet = new Set(q.correctIds ?? (q.correct ? [q.correct] : []));
  const label = q.qtype === 'multi_select' ? ' (רב-ברירה: כמה תשובות נכונות)' : '';
  return label + '\n' + (q.choices ?? []).map((c) => `  ${c.id}) ${c.text}${correctSet.has(c.id) ? '  ✓' : ''}`).join('\n');
}

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
    const listing = items.map((q, i) => `#${i} | ${q.stem}${verifyListing(q)}`).join('\n\n');
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: `אתה שומר סף פדגוגי קפדן שבודק שאלות לימוד לילדים (${context}). תפקידך למצוא פגמים ולפסול. סמן שאלה כלא‑תקינה (ok=false) אם מתקיים ולו אחד מאלה:
- התשובה/ות המסומנות ✓ שגויות או לא מדויקות עובדתית (100% נכונות נדרשת).
- בשאלת רב-ברירה רגילה: יש יותר מתשובה נכונה אחת, או שהתשובה משתמעת לשתי פנים.
- בשאלת רב-ברירה עם כמה נכונות (multi_select): לא כל התשובות הנכונות סומנו ✓, או שסומנה תשובה שגויה, או שאין בדיוק חלוקה ברורה בין נכונות ללא-נכונות.
- בשאלת השלמה (type_in): התשובה המתקבלת שגויה, או שיש תשובות נכונות נוספות שחסרות ברשימה (השאלה חייבת להיות חד-משמעית).
- טעות עובדתית, ערבוב בין סיפורים/דמויות/אירועים, או ניסוח מבלבל.
- יש שגיאת כתיב, מילה משובשת, או מילה שאינה קיימת בעברית (למשל "מוכמן", "בתחיל") - בכל מקום בשאלה, בתשובות, ברמזים או בהסבר.
- ניסוח עברי מגושם/לא תקין, או שהתשובה הנכונה היא מונח מומצא/לא מקובל (למשל "התגברות ההמון" במקום "אפקט העדר"), או ששאלת ההעשרה מבקשת לנחש שם של מונח מקצועי שילד לא מכיר.
- דורשת ידע נדיר או קריאת טקסט ספציפי שילד בגיל הזה לא בהכרח למד.
- שאלה טריוויאלית ללא ערך לימודי: התשובה הנכונה כתובה כמעט מילה-במילה בגוף השאלה (למשל "כשירד גשם לקחנו מטרייה. למה לקחנו מטרייה?" -> "כי ירד גשם"). שאלה חייבת ללמד משהו (הבנה, אוצר מילים, כלל), לא רק להעתיק.
- הפרה של הכללים הקשיחים לגיל שלהלן (למשל מספרים מחוץ לטווח, גדלים לא סבירים, נושא מעבר לרמת הכיתה).
- (כיתה ה׳) שאלה קלה מדי, ברמת כיתות ב׳-ג׳ וללא אתגר אמיתי לגיל (למשל "כמה צלעות יש במשולש?", "האם לריבוע 4 צלעות שוות?") - פסול.
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
- גדלים ריאליים: מחירים וכמויות סבירים (לא מיליונים בבעיה יומיומית).
- רמה של כיתה ה׳, לא של כיתות ב׳-ג׳: הימנע משאלות טריוויאליות (למשל "היקף ריבוע שצלעו 5", חיבור חד-ספרתי). העדף בעיות רב-שלביות, שברים/אחוזים/ממוצע/יחס, ובגאומטריה שטח, זוויות ונפח - לא רק היקף בסיסי.`;
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

  // Dedup against the whole SUBJECT (all grades/topics), not just this topic, so
  // the same wording can't appear in two topics or for both children.
  const { data: sibTopics } = await sb.from('curriculum_topics').select('id').eq('subject', topic.subject);
  const sibIds = (sibTopics ?? []).map((t) => t.id as string);
  const { data: existing } = sibIds.length
    ? await sb.from('questions_bank').select('payload').in('topic_id', sibIds)
    : { data: [] as { payload: unknown }[] };
  const existingStems = new Set(
    (existing ?? []).map((r) => norm(String((r.payload as Record<string, unknown>)?.stem ?? ''))),
  );

  const gradeLabel = topic.grade === 'grade_5' ? 'כיתה ה׳' : topic.grade === 'grade_3' ? 'כיתה ג׳' : 'העשרה';
  const subjectLabel = SUBJECT_LABEL[topic.subject] ?? topic.subject;
  const arabicNote = topic.subject === 'arabic'
    ? ` זו ערבית ${topic.arabic_variant === 'msa' ? 'ספרותית (MSA)' : 'מדוברת'}. השאלה מלמדת אוצר מילים בערבית:
נסח כל שאלה בעברית פשוטה ("איך אומרים X בערבית?" / "מה פירוש המילה Y?"). ארבע התשובות חייבות להיות מילים בערבית בתעתיק עברי מנוקד (לא תרגום לעברית!), והתשובה הנכונה היא המילה הערבית הנכונה. אל תיצור שאלה שהתשובה הנכונה בה היא מילה בעברית. ודא שהתעתיק והמשמעות נכונים ותקינים.`
    : '';
  const hebrewNote = topic.subject === 'hebrew'
    ? ` עברית - איכות פדגוגית (חשוב מאוד): לכל שאלה חייבת להיות מטרה לימודית - אוצר מילים בהקשר, נרדפות/הפכים, זכר/נקבה ויחיד/רבים, שם עצם/תואר/פועל, רעיון מרכזי, הסקה או סדר אירועים. אסור לחלוטין שאלה שהתשובה שלה כתובה כמעט מילה-במילה בגוף השאלה (למשל "כשירד גשם לקחנו מטרייה. למה לקחנו מטרייה?" - טריוויאלי, פסול). בהבנת הנקרא: הצג קטע קצר של 2-4 משפטים, ואז שאל שאלה שדורשת הבנה אמיתית (הסקה, רעיון מרכזי, משמעות מילה בהקשר) - לא העתקה של משפט מהקטע.`
    : '';
  const giftedNote = topic.subject === 'gifted'
    ? ` זהו פריט חשיבה למסלול מחוננים (בסגנון מבחני איתור): צור אנלוגיה מילולית / סדרת מספרים / "יוצא דופן" / חידת היגיון קצרה. נסח את החידה במלואה בגוף השאלה (למשל בסדרה כתוב את כל האיברים והסימן __; באנלוגיה כתוב "א׳ ל-ב׳ כמו ג׳ ל-?"). ודא תשובה אחת נכונה בלבד שנובעת מחוק/יחס עקבי יחיד, ושלושה מסיחים סבירים אך שגויים.`
    : '';

  // Arabic (transliterated vocab) and the gifted reasoning items need exactly one
  // correct option, so keep them multiple-choice; everything else varies its types.
  const restrictMC = topic.subject === 'arabic' || topic.subject === 'gifted';
  // type_in fits factual subjects with a short unambiguous answer. It's a bad fit
  // for the abstract enrichment subjects, where it turns into "name the concept"
  // (jargon recall) - so it's disabled there.
  const TYPE_IN_OK = new Set(['math', 'geometry', 'hebrew', 'english', 'arabic', 'science', 'bible', 'history', 'geography']);
  const allowTypeIn = TYPE_IN_OK.has(topic.subject);
  const typesNote = restrictMC
    ? 'סוג השאלות: כולן multiple_choice עם 4 אפשרויות (a,b,c,d) ובדיוק תשובה נכונה אחת. מלא choices ו-correct_choice_id. (qtype="multiple_choice").'
    : `גוון את סוגי השאלות במנה (קבע שדה qtype לכל שאלה, ומלא רק את השדות של אותו סוג):
- רוב השאלות multiple_choice: 4 אפשרויות (a,b,c,d) ותשובה נכונה אחת (choices + correct_choice_id).
- שלב גם multi_select: 4 אפשרויות, אך 2 או 3 מהן נכונות (choices + correct_choice_ids עם כל הנכונות, ולפחות אפשרות אחת שגויה). נסח את גוף השאלה כך שברור שיש כמה תשובות (למשל "אילו מהבאים נכונים?").
- שלב גם true_false: קביעה אחת, וב-answer_bool אם היא נכונה (true) או לא (false). בלי choices.${allowTypeIn ? `
- שלב גם type_in: שאלה עם תשובה קצרה וחד-משמעית (מילה אחת או מספר) שהילדה כותבת; ב-answers רשום את כל הצורות המקובלות. אל תשתמש ב-type_in לשאלה פתוחה או רב-משמעית, ולעולם אל תבקש "שם את התהליך/המושג".` : `
- אל תשתמש ב-type_in בנושא הזה. בשום מקרה אל תבקש מהילדה לכתוב שם של מושג או תהליך.`}`;

  const diagramNote = topic.subject === 'geometry'
    ? ` המחשה: כשהשאלה עוסקת בצורה, הוסף שדה diagram שמתאר אותה בדיוק לפי הנתונים בשאלה - kind ("rect"/"square"/"triangle"/"circle") והמידות (w,h; s לריבוע; base,height למשולש; r לרדיוס) ו-unit (יחידת מידה, למשל "ס״מ"). המידות ב-diagram חייבות להתאים למספרים שבשאלה.`
    : topic.subject === 'gifted'
      ? ` המחשה: כשמתאים (במיוחד "יוצא דופן" או סדרת צורות), הוסף שדה diagram מסוג kind:"shapes" עם items - רשימת צורות (shape: circle/square/triangle/star, אפשר color בהקס) שמייצגת את הפריט הוויזואלי (למשל שלוש דומות ואחת שונה). ודא שהתשובה הנכונה עקבית עם מה שמצויר.`
      : '';

  const gradeAge = topic.grade === 'grade_5' ? 'בני 10-11, כיתה ה׳ - רמה מאתגרת שמתאימה באמת לגיל, לא חומר של כיתות ב׳-ג׳'
    : topic.grade === 'grade_3' ? 'בני 8-9, כיתה ג׳'
    : 'העשרה, בני 8-11';
  // Grade 3 is a beginning reader (Mili). Enrichment topics are shared with her
  // too, so vocalize those with nikud as well (harmless for the older reader).
  const needsNikud = topic.grade === 'grade_3' || topic.grade === 'enrichment';
  const nikudNote = needsNikud
    ? `
ניקוד (חשוב מאוד): הקהל כולל קוראת מתחילה בכיתה ג׳. נַקֵּד ניקוד מלא ומדויק את כל הטקסט בעברית - גם השאלה, גם כל התשובות, גם הרמזים וגם ההסבר. הקפד על ניקוד תקני ונכון לכל מילה. מספרות וסימנים נשארים כרגיל.
שפה פשוטה: משפטים קצרים ומילים מוכרות המתאימות גם לילדה בת 8. הימנע ממילים נדירות או מופשטות מדי.`
    : '';
  const system = `אתה יוצר שאלות לימוד לילדים בעברית לאפליקציה חינוכית.
קהל היעד: ${gradeAge}. חשוב מאוד: התאם את רמת הקושי לגיל האמיתי - שאלות לכיתה ה׳ צריכות להיות מאתגרות ובעומק המתאים (למשל בעברית: הבחנה בין עובדה לדעה, משמעות בהקשר, מבנה טיעון; בחשבון: שברים, אחוזים, בעיות מילוליות רב-שלביות), לא ידע בסיסי מדי.
${typesNote}
difficulty: דרג את קושי השאלה 1-5 ביחס לגיל.
hints: מערך של בדיוק 2 רמזים מדורגים - רמז 1 כיוון עדין, רמז 2 חזק וממוקד יותר. אסור לחלוטין שרמז יכיל את התשובה או ירמוז עליה ישירות (למשל בשאלה "כמה ס"מ במטר?" רמז כמו "יש 100" או "התשובה 100" - פסול; רמז טוב: "חשבי בקפיצות של עשרות"). הרמז מכוון לחשיבה, לא מוסר את הפתרון.
explanation: משפט קצר שמסביר למה התשובה נכונה.
לפחות מסיח שגוי אחד עם שדה misconception קצר באנגלית.
עברית תקנית וידידותית. בלי אימוגי. גיוון גבוה בין השאלות.
חשוב: השאלה חייבת להיות ניתנת למענה מידע כללי שנלמד בגיל הזה - בלי להניח שקראו טקסט מסוים או פרק ספציפי. הישאר בליבת הנושא הנלמד בבית הספר; הימנע מפרטים נדירים, אזוטריים או מבלבלים (למשל בתנ״ך - רק סיפורים ודמויות מוכרים ומרכזיים, בלי לערבב אירועים או דמויות מסיפורים שונים).
${gradeRules(topic.grade)}
${groundTruthFor(topic.subject, topic.grade) ? `מקור אמת לנושא (הישאר בתוך הגבולות והעובדות האלה בלבד):
${groundTruthFor(topic.subject, topic.grade)}
` : ''}גיוון (חשוב): שנה בין השאלות את המספרים, הערכים וההקשרים - אל תשאל את אותו תרגיל שוב בניסוח אחר (למשל לא לחזור על "25% מתוך 100" עם מילים שונות). כל שאלה צריכה חישוב או תוכן שונה ממש. אל תיצור במנה שתי שאלות שבודקות את אותו רעיון או אותה השוואה (למשל "מה גדול יותר, חצי או שליש?" פעמיים בניסוחים שונים) - כל שאלה בודקת דבר אחר.
עברית ונוסח (חשוב מאוד):
- עברית תקנית, טבעית וברורה. משפט שאלה שלם ומדויק, בלי שגיאות ובלי ניסוח מגושם או מבלבל.
- כל מילה חייבת להיות מילה אמיתית ומאויתת נכון בעברית. אל תמציא מילים ואל תשבש איות (למשל כתוב "מוצף" ולא "מוכמן", "מתחיל" ולא "בתחיל"). קרא שוב כל משפט לפני שאתה שולח.
- בנושאי חשיבה/העשרה: אל תבקש מהילדה לנחש שם של מונח מקצועי ("איך קוראים ל...", "שם את התהליך"); שאל על ההבנה של הרעיון. כל מונח שמופיע כתשובה חייב להיות ביטוי עברי אמיתי ומקובל (לא המצאה).
- דקדוק תקין חובה: התאמת מין/מספר ומילות קישור נכונות. למשל "החלטה חכמה" (לא "חוכמה"), "בין שתי אפשרויות" (לא "בין שני עקרונות"). קרא כל משפט שוב ותקן ניסוח מגושם.
- אל תחשוף את התשובה בתוך השאלה. במיוחד בשאלות אוצר מילים (אנגלית/ערבית): אל תזכיר את המילה הנכונה בגוף השאלה. נסח נקי, למשל "איזו מילה באנגלית מתארת משהו גדול מאוד?" (ולא להזכיר את enormous/huge בשאלה).
- בשאלות בחירה: כל ארבע האפשרויות מאותה קטגוריה והגיוניות; ב-multiple_choice רק אחת נכונה, וב-multi_select 2-3 נכונות. אל תסמן תשובה נכונה שאינה באמת נכונה.${nikudNote}`;

  const avoid = [...existingStems].slice(0, 40);
  const userMsg = `נושא: ${subjectLabel} - ${topic.sub_topic} (${gradeLabel}).${arabicNote}${giftedNote}${hebrewNote}${diagramNote}
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

  type Ch = { id?: string; text?: string; misconception?: string };
  type Q = { tag?: string; qtype?: string; stem?: string; difficulty?: number; hints?: string[]; explanation?: string;
    correct_choice_id?: string; correct_choice_ids?: string[]; answer_bool?: boolean; answers?: string[]; choices?: Ch[]; diagram?: unknown };
  const okId = (id?: string): id is string => !!id && ['a', 'b', 'c', 'd'].includes(id);
  const mapChoices = (cs: Ch[]) => cs.map((c) => ({
    id: c.id, text: String(c.text),
    ...(c.misconception ? { misconception: String(c.misconception) } : {}),
  }));
  const coins = topic.grade === 'grade_5' ? 12 : 10;

  const rows: Record<string, unknown>[] = [];
  const verifyItems: VerifyItem[] = [];
  for (const raw of questions as Q[]) {
    if (!raw?.stem) continue;
    const key = norm(String(raw.stem));
    if (existingStems.has(key)) continue; // dedup vs old bank + this batch
    const hints = Array.isArray(raw.hints) ? raw.hints.map(String).filter(Boolean).slice(0, 2) : [];
    const diff = Math.min(5, Math.max(1, Math.round(Number(raw.difficulty ?? 2))));
    const stem = String(raw.stem);
    const dg = validateDiagram(raw.diagram);
    const base = {
      tag: String(raw.tag ?? ''), stem, hint: hints[0] ?? '', hints,
      explanation: raw.explanation ? String(raw.explanation) : undefined, coins,
      ...(dg ? { diagram: dg } : {}),
    };
    const qtype = restrictMC ? 'multiple_choice' : (raw.qtype ?? 'multiple_choice');
    let type = 'multiple_choice';
    let payload: Record<string, unknown> | null = null;
    let vi: VerifyItem | null = null;

    if (qtype === 'true_false') {
      if (typeof raw.answer_bool !== 'boolean') continue;
      type = 'true_false';
      payload = { ...base, answer: raw.answer_bool };
      vi = { stem, qtype: 'true_false', correct: raw.answer_bool ? 't' : 'f' };
    } else if (qtype === 'type_in') {
      if (!allowTypeIn) continue; // no fill-in for abstract subjects (avoids "name the concept")
      const answers = Array.isArray(raw.answers) ? raw.answers.map((a) => String(a).trim()).filter(Boolean) : [];
      if (!answers.length) continue;
      type = 'type_in';
      payload = { ...base, answers };
      vi = { stem, qtype: 'type_in', answers };
    } else if (qtype === 'multi_select') {
      if (!Array.isArray(raw.choices) || raw.choices.length !== 4) continue;
      if (raw.choices.some((c) => !okId(c.id) || !c.text)) continue;
      const uniq = [...new Set((raw.correct_choice_ids ?? []).filter(okId))];
      // Need at least two correct and at least one wrong option.
      if (uniq.length < 2 || uniq.length >= 4) continue;
      if (!uniq.every((id) => raw.choices!.some((c) => c.id === id))) continue;
      const choices = mapChoices(raw.choices);
      type = 'multi_select';
      payload = { ...base, choices, correct_choice_ids: uniq };
      vi = { stem, qtype: 'multi_select', choices: choices as { id: string; text: string }[], correctIds: uniq };
    } else {
      if (!Array.isArray(raw.choices) || raw.choices.length !== 4) continue;
      const cid = raw.correct_choice_id;
      if (!okId(cid)) continue;
      if (!raw.choices.some((c) => c.id === cid && c.text)) continue;
      if (raw.choices.some((c) => !okId(c.id) || !c.text)) continue;
      const choices = mapChoices(raw.choices);
      type = 'multiple_choice';
      payload = { ...base, choices, correct_choice_id: cid };
      vi = { stem, qtype: 'multiple_choice', choices: choices as { id: string; text: string }[], correct: cid };
    }
    if (!payload || !vi) continue;
    existingStems.add(key);
    rows.push({ topic_id: topicId, type, difficulty: diff, source: 'ai_generated', verification_status: 'auto_passed', payload });
    verifyItems.push(vi);
  }
  if (!rows.length) return { inserted: 0, reason: 'all-duplicates' };

  // Never let a hint give away the answer: drop any hint that contains the correct
  // answer's text (a common model slip). Falls back to a generic nudge if needed.
  for (const r of rows) {
    const p = r.payload as Record<string, unknown>;
    const choices = (p.choices as { id: string; text: string }[]) ?? [];
    let reveals: string[] = [];
    if (r.type === 'multiple_choice') reveals = [choices.find((c) => c.id === p.correct_choice_id)?.text ?? ''];
    else if (r.type === 'multi_select') reveals = ((p.correct_choice_ids as string[]) ?? []).map((id) => choices.find((c) => c.id === id)?.text ?? '');
    else if (r.type === 'type_in') reveals = (p.answers as string[]) ?? [];
    const bad = reveals.map(norm).filter((s) => s.length >= 1);
    const kept = (Array.isArray(p.hints) ? (p.hints as string[]) : []).filter((h) => {
      const n = norm(h);
      return !bad.some((b) => n.includes(b));
    });
    const clean = kept.length ? kept : ['תחשבי שוב לאט - מה השאלה בעצם מבקשת?'];
    p.hints = clean;
    p.hint = clean[0] ?? '';
  }

  // Second-pass verification: anything the checker flags is held for parent review.
  const flagged = await verifyQuestions(apiKey, verifyItems, `${subjectLabel} · ${gradeLabel}`, gradeRules(topic.grade), groundTruthFor(topic.subject, topic.grade));
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
 * several nightly runs it covers the whole bank. Covers multiple_choice,
 * multi_select, true/false and type_in.
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
      const CHECKABLE = new Set(['multiple_choice', 'multi_select', 'true_false', 'type_in']);
      const items = (qs ?? [])
        .filter((q) => CHECKABLE.has(String(q.type)))
        .map((q) => {
          const p = q.payload as { stem?: string; choices?: { id: string; text: string }[]; correct_choice_id?: string; correct_choice_ids?: string[]; answer?: unknown; answers?: unknown[] };
          const stem = String(p.stem ?? '');
          if (q.type === 'true_false') {
            const yes = p.answer === true || p.answer === 'true' || p.correct_choice_id === 't';
            return { id: q.id as string, stem, vi: { stem, qtype: 'true_false', correct: yes ? 't' : 'f' } as VerifyItem, ok: !!stem };
          }
          if (q.type === 'type_in') {
            const answers = Array.isArray(p.answers) ? p.answers.map((a) => String(a)) : [];
            return { id: q.id as string, stem, vi: { stem, qtype: 'type_in', answers } as VerifyItem, ok: !!stem && !!answers.length };
          }
          const choices = p.choices ?? [];
          if (q.type === 'multi_select') {
            const ids = Array.isArray(p.correct_choice_ids) ? p.correct_choice_ids.map(String) : [];
            return { id: q.id as string, stem, vi: { stem, qtype: 'multi_select', choices, correctIds: ids } as VerifyItem, ok: !!stem && choices.length > 0 };
          }
          return { id: q.id as string, stem, vi: { stem, qtype: 'multiple_choice', choices, correct: String(p.correct_choice_id ?? '') } as VerifyItem, ok: !!stem && choices.length > 0 };
        })
        .filter((i) => i.ok);
      if (!items.length) continue;
      out.checked += items.length;
      const flagged = await verifyQuestions(
        apiKey,
        items.map((i) => i.vi),
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

/**
 * Auto-clean the parent's review pile: permanently remove AI-generated questions
 * that have sat flagged (hidden from the child) for over `days` without being
 * approved. So a parent never has to work through flagged questions manually -
 * bad ones expire on their own and the topic refills with fresh content.
 */
export async function purgeStaleFlagged(days = 7): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  try {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await sb.from('questions_bank')
      .delete()
      .eq('source', 'ai_generated')
      .eq('verification_status', 'auto_flagged')
      .lt('created_at', cutoff)
      .select('id');
    return (data ?? []).length;
  } catch {
    return 0;
  }
}

/**
 * Nightly self-heal: remove duplicate questions that share the same wording
 * within a subject (across all its topics/grades), so the same question can't
 * show for both children or come back again. Keeps one copy, and never deletes a
 * question that already has attempts. Samples a few subjects per run.
 */
export async function purgeDuplicateQuestions(maxSubjects = 4): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  let removed = 0;
  try {
    const { data: topics } = await sb.from('curriculum_topics').select('id,subject');
    if (!topics?.length) return 0;
    const bySubject = new Map<string, string[]>();
    for (const t of topics) {
      const arr = bySubject.get(t.subject as string) ?? [];
      arr.push(t.id as string);
      bySubject.set(t.subject as string, arr);
    }
    const subjects = [...bySubject.keys()].sort(() => Math.random() - 0.5).slice(0, maxSubjects);
    for (const subj of subjects) {
      const { data: qs } = await sb.from('questions_bank').select('id,payload').in('topic_id', bySubject.get(subj)!);
      if (!qs?.length) continue;
      const seen = new Set<string>();
      const dupIds: string[] = [];
      for (const q of qs) {
        const stem = norm(String((q.payload as Record<string, unknown>)?.stem ?? ''));
        if (!stem) continue;
        if (seen.has(stem)) dupIds.push(q.id as string); else seen.add(stem);
      }
      if (!dupIds.length) continue;
      const { data: att } = await sb.from('attempts_log').select('question_id').in('question_id', dupIds);
      const attempted = new Set((att ?? []).map((r) => r.question_id as string));
      const toDelete = dupIds.filter((id) => !attempted.has(id));
      if (toDelete.length) {
        const { data: del } = await sb.from('questions_bank').delete().in('id', toDelete).select('id');
        removed += (del ?? []).length;
      }
    }
    return removed;
  } catch {
    return 0;
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
