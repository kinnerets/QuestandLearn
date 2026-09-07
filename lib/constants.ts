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
  history: 'היסטוריה',
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

/** A distinct, kid-friendly accent colour per subject - used to tint the subject
 *  icon tiles on the map and home so the subjects feel colourful and easy to tell
 *  apart. Falls back to the kind colour when a subject isn't listed. */
export const SUBJECT_COLOR: Record<string, string> = {
  math: '#FF5CA8', geometry: '#F97316', hebrew: '#FF2A85', bible: '#A855F7',
  english: '#38BDF8', arabic: '#22C55E', science: '#F5B301', geography: '#14B8A6',
  history: '#C2703D', gifted: '#8B5CF6',
  future_skills: '#F59E0B', economics: '#10B981', fashion: '#EC4899', politics: '#64748B',
  ai: '#06B6D4', philosophy: '#6366F1', metacognition: '#0EA5E9', geopolitics: '#0D9488',
  cognitive_bias: '#7C3AED', epigenetics: '#16A34A', procrastination: '#EF4444',
  decision_making: '#EAB308', neuroplasticity: '#DB2777', financial_literacy: '#059669',
  seasonal: '#E11D48',
};

/** Which station "kind" (icon/colour family) each subject belongs to. */
export const SUBJECT_KIND: Record<string, 'core' | 'lang' | 'future' | 'lead'> = {
  math: 'core', geometry: 'core', hebrew: 'core', bible: 'core', science: 'future',
  arabic: 'lang', english: 'lang',
  future_skills: 'future', geography: 'future', history: 'future',
  economics: 'future', fashion: 'future', politics: 'future', ai: 'future', philosophy: 'future',
  metacognition: 'future', geopolitics: 'future', cognitive_bias: 'future', epigenetics: 'future',
  procrastination: 'future', decision_making: 'future', neuroplasticity: 'future', financial_literacy: 'future',
  seasonal: 'future', gifted: 'future',
  leadership: 'lead',
};
