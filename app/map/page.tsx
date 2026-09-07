import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Capi } from '@/components/Capi';
import { BottomNav } from '@/components/BottomNav';
import { STATION_ICON, SUBJECT_ICON, ChevronIcon, SparkIcon } from '@/components/icons';
import { getChildren, getSubjectCatalog, getCompassWorlds, type SubjectCard, type CompassWorld } from '@/lib/db';
import { SUBJECT_COLOR } from '@/lib/constants';
import { BookIcon, CoinIcon, StarIcon, HeartIcon } from '@/components/icons';
import { selectedChildId } from '@/lib/session';

const WORLD_ICON = [BookIcon, CoinIcon, StarIcon, HeartIcon];

export const dynamic = 'force-dynamic';

// Shown when there's no live DB yet (mock mode) so the map isn't empty.
const MOCK_CATALOG: SubjectCard[] = [
  { subject: 'math', label: 'חשבון', kind: 'core', accuracy: 0.6, answered: 5, solved: 3, total: 4 },
  { subject: 'arabic', label: 'ערבית', kind: 'lang', accuracy: 0.4, answered: 0, solved: 0, total: 3 },
  { subject: 'future_skills', label: 'שער העתיד', kind: 'future', accuracy: 0.5, answered: 0, solved: 0, total: 2 },
];

function tier(m: number) { return m >= 0.7 ? 'good' : m >= 0.4 ? 'mid' : 'low'; }

export default async function MapPage() {
  const selectedId = selectedChildId();
  const children = await getChildren();
  if (children && children.length && (!selectedId || !children.some((c) => c.id === selectedId))) {
    redirect('/profiles');
  }
  const child = children?.find((c) => c.id === selectedId) ?? children?.[0] ?? null;
  const [catalog, worlds] = child
    ? await Promise.all([
        getSubjectCatalog(child.grade ?? 'grade_3', child.id),
        getCompassWorlds(child.id),
      ])
    : [null, null];
  const subjects = catalog ?? MOCK_CATALOG;
  const leadWorlds: CompassWorld[] = worlds ?? [];

  return (
    <main className="app-shell">
      <div className="screen-body map">
        <div className="map-head">
          <Capi mood="chill" size={64} />
          <div>
            <h1>כל הנושאים</h1>
            <p>על מה בא לך לתרגל היום?</p>
          </div>
        </div>

        <Link href="/interests" className="interests-cta">
          <span className="interests-cta-ico"><SparkIcon /></span>
          <span className="interests-cta-txt">
            <b>מה מעניין אותך?</b>
            <small>עדכני את תחומי העניין - נתאים לך יותר תרגולים בכיוון</small>
          </span>
          <span className="place-banner-go">›</span>
        </Link>

        <div className="subject-grid">
          {subjects.map((s) => {
            const Icon = SUBJECT_ICON[s.subject] ?? STATION_ICON[s.kind];
            return (
              <Link key={s.subject} href={`/exercise?focus=${s.subject}&from=map`} className="subject-card"
                style={SUBJECT_COLOR[s.subject] ? { ['--subj' as string]: SUBJECT_COLOR[s.subject] } : undefined}>
                <span className={`subject-ico ico-${s.kind}`}
                  style={SUBJECT_COLOR[s.subject] ? { background: SUBJECT_COLOR[s.subject] } : undefined}><Icon /></span>
                <span className="subject-name">{s.label}</span>
                <span className="subject-bar"><i className={tier(s.accuracy)} style={{ width: `${Math.round(s.accuracy * 100)}%` }} /></span>
                <span className="subject-meta">
                  {s.answered > 0 ? `${Math.round(s.accuracy * 100)}% הצלחה` : 'טרם התחלת'}
                </span>
                <span className="subject-go"><ChevronIcon /></span>
              </Link>
            );
          })}

          {leadWorlds.map((w) => {
            const Icon = WORLD_ICON[(w.order - 1) % 4] ?? HeartIcon;
            return (
              <Link key={w.topicId} href={`/exercise?focus=leadership&topic=${w.topicId}&from=map`} className="subject-card">
                <span className="subject-ico ico-lead"><Icon /></span>
                <span className="subject-name">{w.name}</span>
                <span className="subject-meta">מנהיגות</span>
                <span className="subject-go"><ChevronIcon /></span>
              </Link>
            );
          })}
        </div>

        <Link href="/" className="map-back">חזרה למסע היומי</Link>
      </div>

      <BottomNav active="/map" />
    </main>
  );
}
