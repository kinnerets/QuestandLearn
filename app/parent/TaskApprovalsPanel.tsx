'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoinIcon, CheckIcon, CloseIcon } from '@/components/icons';

interface Approval {
  id: string; childId: string; childName: string; taskTitle: string; coins: number; day: string;
}

export function TaskApprovalsPanel({ childId, childName }: { childId?: string; childName?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Approval[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/parent/task-approvals');
      const j = await r.json();
      if (Array.isArray(j?.approvals)) setItems(j.approvals);
    } catch { /* ignore */ }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
    try {
      await fetch('/api/parent/task-approvals', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      // Approving grants coins - refresh so the child's balance updates here and
      // isn't served stale from the router cache when the parent returns home.
      router.refresh();
    } catch { /* ignore */ }
    setBusy(null);
  }

  // Only this child's pending chores (don't show Lia's in Mili's tab).
  const shownItems = childId ? items.filter((a) => a.childId === childId) : items;
  if (!loaded || shownItems.length === 0) return null;

  return (
    <section className="content-panel">
      <div className="parent-head" style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: '1.15rem' }}>מטלות לאישור{childName ? ` · ${childName}` : ''} <span className="flag-count">{shownItems.length}</span></h2>
      </div>
      <p className="content-hint">{childName ?? 'הבנות'} סימנה שביצעה. אישור → המטבעות נזקפות; דחייה → המטלה חוזרת אליה.</p>

      {shownItems.map((a) => (
        <div key={a.id} className="approve-card">
          <div className="approve-main">
            <div className="approve-title">{a.taskTitle}</div>
            <div className="approve-meta">{a.childName} · <span className="approve-coins"><CoinIcon /> {a.coins}</span></div>
          </div>
          <div className="approve-actions">
            <button className="flag-btn approve" disabled={busy === a.id} onClick={() => resolve(a.id, 'approve')}>
              <CheckIcon /> אישור
            </button>
            <button className="flag-btn reject" disabled={busy === a.id} onClick={() => resolve(a.id, 'reject')}>
              <CloseIcon /> דחייה
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
