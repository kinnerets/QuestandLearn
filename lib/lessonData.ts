import type { StationKind } from './types';

export interface Choice {
  id: string;
  text: string;
  misconception?: string;
}

export type QuestionType = 'multiple_choice' | 'multi_select' | 'true_false' | 'type_in';

export interface AcademicStation {
  kind: Exclude<StationKind, 'lead'>;
  title: string;
  position: string;
  subjectLabel?: string;
  subject?: string;
  tag: string;
  stem: string;
  qtype?: QuestionType;      // defaults to multiple_choice
  choices: Choice[];
  correctId: string;
  correctIds?: string[];     // all correct ids for a multi_select question
  answers?: string[];        // accepted answers for a type_in question
  hint: string;
  hint2?: string;
  explanation?: string;
  difficulty?: number;
  coins: number;
  questionId?: string;
  topicId?: string;
}

export interface LeadChoice {
  id: string;
  label: string;
  icon: 'star' | 'home' | 'ear';
}

export interface LeadStation {
  kind: 'lead';
  title: string;
  position: string;
  subjectLabel?: string;
  prompt: string;
  note: string;
  choices: LeadChoice[];
  topicId?: string;
  questionId?: string;
  coins?: number;
}

export type Station = AcademicStation | LeadStation;

/** Today's composed daily path (would come from the Composer + Questions_Bank). */
export const lesson: Station[] = [
  {
    kind: 'core',
    title: 'חשבון',
    position: 'תחנה 1 מתוך 4',
    tag: 'כפל',
    stem: 'כמה זה 7 × 6 ?',
    choices: [
      { id: 'a', text: '42' },
      { id: 'b', text: '48' },
      { id: 'c', text: '36' },
      { id: 'd', text: '40' },
    ],
    correctId: 'a',
    hint: 'נסי לספור בקפיצות של 7: 7, 14, 21, 28… עד שש קפיצות. איפה נוחתים?',
    coins: 10,
  },
  {
    kind: 'lang',
    title: 'ערבית מדוברת',
    position: 'תחנה 2 מתוך 4',
    tag: 'ברכות',
    stem: 'איך אומרים "שלום / היי" בערבית מדוברת?',
    choices: [
      { id: 'a', text: 'מַרְחַבָּא' },
      { id: 'b', text: 'שׁוּכְּרַן' },
      { id: 'c', text: 'יַאללָה' },
      { id: 'd', text: 'בַּסְטָה' },
    ],
    correctId: 'a',
    hint: 'זו הברכה הראשונה שאומרים כשפוגשים מישהו. מתחילה ב‑"מ".',
    coins: 10,
  },
  {
    kind: 'future',
    title: 'שער העתיד · יזמות',
    position: 'תחנה 3 מתוך 4',
    tag: 'המצאות',
    stem: 'מה הצעד הראשון של כל ממציאה חכמה?',
    choices: [
      { id: 'a', text: 'למצוא בעיה שמפריעה' },
      { id: 'b', text: 'לצייר לוגו יפה' },
      { id: 'c', text: 'לבחור שם מגניב' },
      { id: 'd', text: 'לפתוח חנות' },
    ],
    correctId: 'a',
    hint: 'לפני שממציאים פתרון צריך לדעת מה שווה לפתור. ממה אנשים מתעצבנים?',
    coins: 10,
  },
  {
    kind: 'lead',
    title: 'בנק הלב',
    position: 'אי המצפן · מנהיגות',
    prompt: 'מה תעשי היום בשביל מישהו אחר?',
    note: 'אין כאן תשובה נכונה - כל בחירה היא הפקדה טובה ללב.',
    choices: [
      { id: 'a', label: 'לפרגן לחברה על משהו', icon: 'star' },
      { id: 'b', label: 'לעזור במשהו בבית', icon: 'home' },
      { id: 'c', label: 'להקשיב לחברה בלי להפריע', icon: 'ear' },
    ],
  },
];

// Varied copy (spec v4)
export const PRAISE = [
  'יש. ידעת את זה.',
  'בול. ממשיכים הלאה.',
  'נכון מאוד, כל הכבוד.',
  'מדויק - בכיוון מעולה.',
  'יש! עוד אחת נפלה.',
  'חד. ראיתי שחשבת על זה.',
  'מצוין, זה נתפס מהר.',
  'זה בדיוק זה. יאללה קדימה.',
];

export const GENTLE = [
  'זה בסדר גמור לטעות, ככה לומדים. הנה התשובה, ונמשיך יחד.',
  'טעות היא רק שלב בדרך. הנה הפתרון, וממשיכים.',
  'יופי שניסית. זו התשובה - נחזור לזה עוד קצת בהמשך.',
];

export const HEART = [
  'הפקדת ללב. הקשרים שלך מרגישים את זה.',
  'הפקדה יפה - ככה נבנית מנהיגות אמת.',
  'זה בדיוק מה שממלא את בנק הלב.',
];

export function pick(pool: string[], last?: string): string {
  let v = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1) while (v === last) v = pool[Math.floor(Math.random() * pool.length)];
  return v;
}
