'use client';

import { useEffect, useState } from 'react';
import { ChevronIcon } from '@/components/icons';
import { SUBJECT_COLOR } from '@/lib/constants';
import { Section } from './Section';

interface SubStat { id: string; subTopic: string; accuracy: number; answered: number; solved: number; total: number }
interface Subj { subject: string; label: string; kind: string; accuracy: number; answered: number; sub: SubStat[] }

export function SubtopicFocusPanel({ childId, childName }: { childId?: string; childName?: string }) {
  const [data, setData] = useState<Subj[]>([]);
  const [focus, setFocus] = useState<Set<string>>(new Set());
  const [subjFocus, setSubjFocus] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set()); // sub-topics collapsed until tapped
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!childId) return;
    setLoaded(false);
    Promise.all([
      fetch(`/api/parent/breakdown?childId=${encodeURIComponent(childId)}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/parent/focus?childId=${encodeURIComponent(childId)}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([bd, sf]) => {
        if (Array.isArray(bd?.breakdown)) setData(bd.breakdown);
        if (Array.isArray(bd?.focusTopics)) setFocus(new Set(bd.focusTopics));
        if (bd?.recentWrong && typeof bd.recentWrong === 'object') setWrong(bd.recentWrong);
        if (Array.isArray(sf?.focus)) setSubjFocus(new Set(sf.focus));
      })
      .finally(() => setLoaded(true));
  }, [childId]);

  if (!childId || !loaded || data.length === 0) return null;

  async function toggle(topicId: string) {
    const on = !focus.has(topicId);
    const next = new Set(focus);
    if (on) next.add(topicId); else next.delete(topicId);
    setFocus(next);
    await fetch('/api/parent/focus-topic', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, topicId, on }),
    }).catch(() => {});
  }

  async function toggleSubject(subject: string) {
    const next = new Set(subjFocus);
    if (next.has(subject)) next.delete(subject); else next.add(subject);
    setSubjFocus(next);
    await fetch('/api/parent/focus', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, subjects: [...next] }),
    }).catch(() => {});
  }

  return (
    <Section title="חיזוק לפי נושא ותת-נושא" count={(focus.size + subjFocus.size) || undefined} defaultOpen
      hint={`חזקי נושא שלם, או פתחי אותו וחזקי תת-נושא ספציפי${childName ? ` של ${childName}` : ''} - מה שחיזקת יופיע יותר במסע היומי. נושא שעדיין לא תורגל אין לו ציון.`}>
      <div className="pfocus">
        {data.map((s) => {
          const isOpen = open.has(s.subject);
          const subjOn = subjFocus.has(s.subject);
          const toggleOpen = () => setOpen((c) => {
            const n = new Set(c);
            if (n.has(s.subject)) n.delete(s.subject); else n.add(s.subject);
            return n;
          });
          return (
            <div key={s.subject} className={`pfocus-subj${isOpen ? ' open' : ''}`}>
              <div className="pfocus-head">
                <button className="pfocus-toggle" onClick={toggleOpen} aria-expanded={isOpen}>
                  <span className="pfocus-namewrap">
                    <span className="pfocus-dot" style={{ background: SUBJECT_COLOR[s.subject] ?? 'var(--muted)' }} />
                    <span className="pfocus-name">{s.label}</span>
                  </span>
                  <span className="pfocus-score">{s.answered > 0 ? `${Math.round(s.accuracy * 100)}%` : '-'}</span>
                  <span className={`pfocus-chev${isOpen ? ' up' : ''}`}><ChevronIcon /></span>
                </button>
                <button className={`pfocus-btn${subjOn ? ' on' : ''}`} onClick={() => toggleSubject(s.subject)}>
                  {subjOn ? 'מחוזק' : 'חיזוק נושא'}
                </button>
              </div>
              {isOpen && (
                <div className="pfocus-list">
                  {s.sub.map((t) => {
                    const on = focus.has(t.id);
                    const misses = wrong[t.id] ?? [];
                    return (
                      <div key={t.id} className="pfocus-item">
                        <div className="pfocus-row">
                          <span className="pfocus-tname">{t.subTopic}</span>
                          <span className="pfocus-tstat">{t.answered > 0 ? `${Math.round(t.accuracy * 100)}%` : 'טרם תורגל'}</span>
                          <button className={`pfocus-btn${on ? ' on' : ''}`} onClick={() => toggle(t.id)}>
                            {on ? 'מחוזק' : 'חיזוק'}
                          </button>
                        </div>
                        {misses.length > 0 && (
                          <div className="pfocus-wrong">
                            <span className="pfocus-wrong-tag">טעויות מהשבוע</span>
                            {misses.map((m, i) => <div key={i} className="pfocus-wrong-q">{m}</div>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
