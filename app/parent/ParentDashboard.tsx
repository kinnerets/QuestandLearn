'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { CoinIcon, FlameIcon, CloseIcon } from '@/components/icons';
import { TasksPanel } from './TasksPanel';
import { TaskApprovalsPanel } from './TaskApprovalsPanel';
import { SubtopicFocusPanel } from './SubtopicFocusPanel';
import { CapiLogPanel } from './CapiLogPanel';
import { AssessmentsPanel } from './AssessmentsPanel';
import { RewardsPanel } from './RewardsPanel';
import { FlagsPanel } from './FlagsPanel';
import { ApprovedPanel } from './ApprovedPanel';
import { RedemptionsPanel } from './RedemptionsPanel';
import { LocksPanel } from './LocksPanel';
import type { AvatarConfig } from '@/lib/types';
import type { ChildReport } from '@/lib/db';

interface Kid {
  id: string;
  name: string;
  grade: string | null;
  coins: number;
  streak: number;
  avatar: AvatarConfig;
  goalMinutes: number;
  report: ChildReport | null;
}

const GRADE_LABEL: Record<string, string> = { grade_3: 'כיתה ג׳', grade_5: 'כיתה ה׳' };

const MISCONCEPTION_LABEL: Record<string, string> = {
  off_by_one_multiple: 'טעות בלוח הכפל (קפיצה אחת יותר/פחות)',
  bigger_denominator_bigger_fraction: 'חושבת ששבר עם מכנה גדול = גדול יותר',
  add_denominators: 'מחברת מכנים במקום למצוא מכנה משותף',
  confuse_pen_book: 'בלבול בין "עט" ל"ספר" בערבית',
  confuse_water_sun: 'בלבול בין "מים" ל"שמש" בערבית',
};

function pct(x: number) { return Math.round(x * 100); }

export function ParentDashboard({ kids }: { kids: Kid[] }) {
  const router = useRouter();
  const [activeKid, setActiveKid] = useState(kids[0]?.id ?? '');

  async function lock() {
    await fetch('/api/parent/lock', { method: 'POST' }).catch(() => {});
    router.push('/');
    router.refresh();
  }

  const shown = kids.find((k) => k.id === activeKid) ?? kids[0];

  return (
    <main className="app-shell">
      <div className="ex-bar">
        <button className="ex-back" aria-label="יציאה" onClick={lock}><CloseIcon /></button>
        <div className="ex-head-title">אזור הורים</div>
        <div style={{ width: 34 }} />
      </div>
      <div className="screen-body parent">
        {kids.length === 0 && <div className="parent-empty">עדיין אין פרופילים במאגר.</div>}

        {/* ── Family-wide management (shared by both girls) ── */}
        <div className="parent-section-label">כללי - לשתי הבנות</div>
        <TasksPanel />
        <RewardsPanel />
        <LocksPanel />
        <FlagsPanel />
        <ApprovedPanel />

        {/* ── Per-child area: the tabs switch only this part ── */}
        <div className="parent-section-label per-kid">אישי - לכל בת</div>

        {kids.length > 1 && (
          <div className="kid-tabs">
            {kids.map((k) => (
              <button key={k.id} className={`kid-tab${k.id === shown?.id ? ' on' : ''}`}
                onClick={() => setActiveKid(k.id)}>{k.name}</button>
            ))}
          </div>
        )}

        {shown && (
          <div className="parent-reports">
            <ReportCard key={shown.id} kid={shown} />
          </div>
        )}

        <SubtopicFocusPanel childId={shown?.id} childName={shown?.name} />

        <TaskApprovalsPanel childId={shown?.id} childName={shown?.name} />

        <RedemptionsPanel childName={shown?.name} />

        <AssessmentsPanel childId={shown?.id} />

        <CapiLogPanel childId={shown?.id} />
      </div>

      <div className="parent-foot">
        <button className="cta" onClick={lock}>יציאה ונעילה</button>
      </div>
    </main>
  );
}

function ReportCard({ kid }: { kid: Kid }) {
  const r = kid.report;
  const hasData = r && r.answered > 0;

  return (
    <div className="report-card">
      <div className="report-top">
        <div className="parent-av"><Avatar config={kid.avatar} crop size={48} /></div>
        <div className="report-id">
          <div className="parent-kid-name">{kid.name}</div>
          <div className="parent-kid-sub">
            {GRADE_LABEL[kid.grade ?? ''] ?? '-'} · יעד ~{kid.goalMinutes} דק׳
          </div>
        </div>
        <div className="report-coins">
          <span><CoinIcon /> {kid.coins}</span>
          <span><FlameIcon /> {kid.streak}</span>
        </div>
      </div>

      {!hasData && (
        <div className="report-empty">אין עדיין נתונים השבוע - הדוח יתמלא אחרי כמה תרגולים.</div>
      )}

      {hasData && r && (
        <>
          <div className="report-stats">
            <Stat value={`${pct(r.accuracy)}%`} label="דיוק" />
            <Stat value={String(r.answered)} label="שאלות השבוע" />
            <Stat value={`${r.activeDays}/7`} label="ימים פעילים" />
            <Stat value={`~${r.learnMinutes}׳`} label="זמן למידה" />
          </div>

          {/* Per-subject/sub-topic mastery + reinforce lives in the collapsible
              "חיזוק לפי תת-נושא" panel below, so it isn't duplicated here. */}

          {r.misconceptions.length > 0 && (
            <div className="report-section">
              <div className="report-section-title">לתת עליו את הדעת</div>
              <ul className="misc-list">
                {r.misconceptions.map((m) => (
                  <li key={m}>{MISCONCEPTION_LABEL[m] ?? 'טעות חוזרת בנושא'}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="report-stat">
      <div className="report-stat-val">{value}</div>
      <div className="report-stat-lbl">{label}</div>
    </div>
  );
}
