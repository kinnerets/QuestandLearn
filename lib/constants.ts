// Client-safe shared constants (no server-only imports here).

/** Cookie that stores which child profile is active. */
export const CHILD_COOKIE = 'ql_child';

/** Hebrew label per curriculum subject. */
export const SUBJECT_LABEL: Record<string, string> = {
  math: 'חשבון',
  geometry: 'גאומטריה',
  hebrew: 'עברית',
  bible: 'תנ״ך',
  science: 'מדע',
  arabic: 'ערבית',
  english: 'אנגלית',
  geography: 'גאוגרפיה',
  future_skills: 'יזמות',
  economics: 'כלכלה',
  fashion: 'אופנה',
  politics: 'פוליטיקה',
  ai: 'בינה מלאכותית',
  philosophy: 'פילוסופיה',
  metacognition: 'חשיבה על חשיבה',
  geopolitics: 'גאופוליטיקה',
  cognitive_bias: 'הטיות חשיבה',
  epigenetics: 'אפיגנטיקה',
  procrastination: 'מדע הדחיינות',
  decision_making: 'קבלת החלטות',
  neuroplasticity: 'גמישות מוחית',
  financial_literacy: 'חינוך פיננסי',
  seasonal: 'עונתי',
  gifted: 'מחוננים',
  leadership: 'מנהיגות',
};

/** Enrichment subjects a parent may want to gate (sensitive) - locked by default. */
export const SENSITIVE_SUBJECTS = new Set(['politics', 'ai']);

/** Interests a child can pick - used to bias the daily mix toward what she loves. */
export const INTERESTS: { id: string; label: string }[] = [
  { id: 'animals', label: 'בעלי חיים' },
  { id: 'space', label: 'חלל וכוכבים' },
  { id: 'nature', label: 'טבע' },
  { id: 'fashion', label: 'אופנה ועיצוב' },
  { id: 'tech', label: 'טכנולוגיה והמצאות' },
  { id: 'money', label: 'כסף ועסקים' },
  { id: 'stories', label: 'סיפורים וספרים' },
  { id: 'world', label: 'מדינות ועולם' },
  { id: 'sports', label: 'ספורט' },
  { id: 'games', label: 'משחקים וחשיבה' },
];

/** Which subjects each interest nudges to the front of the daily mix / map. */
export const INTEREST_SUBJECTS: Record<string, string[]> = {
  animals: ['science'],
  space: ['science'],
  nature: ['science', 'geography'],
  fashion: ['fashion'],
  tech: ['future_skills', 'ai'],
  money: ['economics'],
  stories: ['hebrew', 'bible'],
  world: ['geography'],
  sports: ['science', 'geography'],
  games: ['future_skills', 'math'],
};

/** Collapse a set of interest ids into the subjects they favor. */
export function subjectsForInterests(interests: string[]): Set<string> {
  const out = new Set<string>();
  for (const i of interests) for (const s of INTEREST_SUBJECTS[i] ?? []) out.add(s);
  return out;
}

/** Which station "kind" (icon/colour family) each subject belongs to. */
export const SUBJECT_KIND: Record<string, 'core' | 'lang' | 'future' | 'lead'> = {
  math: 'core', geometry: 'core', hebrew: 'core', bible: 'core', science: 'future',
  arabic: 'lang', english: 'lang',
  future_skills: 'future', geography: 'future',
  economics: 'future', fashion: 'future', politics: 'future', ai: 'future', philosophy: 'future',
  metacognition: 'future', geopolitics: 'future', cognitive_bias: 'future', epigenetics: 'future',
  procrastination: 'future', decision_making: 'future', neuroplasticity: 'future', financial_literacy: 'future',
  seasonal: 'future', gifted: 'future',
  leadership: 'lead',
};
