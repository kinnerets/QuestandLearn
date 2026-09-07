'use client';

import { useEffect, useState } from 'react';
import { Section } from './Section';
import { INTERESTS } from '@/lib/constants';
import { CloseIcon } from '@/components/icons';

/** Parent view of a child's interests: the presets she picked plus anything she
 *  typed herself, each removable. Interests bias the daily mix toward what she
 *  loves; this gives the parent visibility and control over the free-text ones. */
export function InterestsViewPanel({ childId, childName }: { childId?: string; childName?: string }) {
  const [items, setItems] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!childId) return;
    setLoaded(false);
    fetch(`/api/parent/interests?childId=${encodeURIComponent(childId)}`)
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.interests)) setItems(j.interests as string[]); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [childId]);

  if (!childId || !loaded) return null;

  const labelOf = (id: string) => INTERESTS.find((it) => it.id === id)?.label;

  async function remove(id: string) {
    const next = items.filter((x) => x !== id);
    setItems(next);
    await fetch('/api/parent/interests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, interests: next }),
    }).catch(() => {});
  }

  return (
    <Section title="תחומי עניין" count={items.length || undefined}
      hint={`מה ${childName ?? 'הבת'} בחרה, וגם מה שהיא כתבה בעצמה. הבחירות מטות את התמהיל היומי לכיוון שהיא אוהבת. אפשר להסיר כל דבר.`}>
      {items.length === 0 ? (
        <p className="content-hint">עדיין לא נבחרו תחומי עניין.</p>
      ) : (
        <div className="pint-list">
          {items.map((id) => {
            const label = labelOf(id);
            const custom = !label;
            return (
              <span key={id} className={`pint-chip${custom ? ' custom' : ''}`}>
                <span>{label ?? id}</span>
                {custom && <span className="pint-tag">כתבה בעצמה</span>}
                <button className="pint-x" onClick={() => remove(id)} aria-label="הסרה"><CloseIcon /></button>
              </span>
            );
          })}
        </div>
      )}
    </Section>
  );
}
