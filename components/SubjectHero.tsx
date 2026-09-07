import { SUBJECT_ICON } from './icons';
import { SUBJECT_COLOR } from '@/lib/constants';

/** A small, friendly per-subject illustration shown above a question, so every
 *  subject has a clear visual identity. Uses the subject's own icon + colour
 *  (falls back to a bulb for enrichment subjects without a dedicated icon). */
export function SubjectHero({ subject }: { subject?: string }) {
  if (!subject) return null;
  const Icon = SUBJECT_ICON[subject] ?? SUBJECT_ICON.future_skills;
  const color = SUBJECT_COLOR[subject] ?? 'var(--magenta)';
  return (
    <div className="subj-hero">
      <span className="subj-hero-badge" style={{ background: color }}><Icon /></span>
    </div>
  );
}
