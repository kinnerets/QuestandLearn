'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoinIcon } from '@/components/icons';

/** Parent control to grant or deduct a child's coins - so corrections (e.g. after
 *  a bug, or a manual reward) need no database access. */
export function CoinAdjustPanel({ childId, childName, coins }: { childId: string; childName?: string; coins: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(50);
  const [balance, setBalance] = useState(coins);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function apply(sign: 1 | -1) {
    const delta = sign * Math.abs(Math.round(amount || 0));
    if (busy || !delta) return;
    setBusy(true);
    setNote('');
    try {
      const r = await fetch('/api/parent/coins', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ childId, delta }),
      });
      const j = await r.json();
      if (typeof j?.coins === 'number') {
        setBalance(j.coins);
        setNote(delta > 0 ? `נוספו ${delta} מטבעות` : `הופחתו ${Math.abs(delta)} מטבעות`);
        router.refresh(); // update the balance shown elsewhere too
      } else {
        setNote('לא הצלחתי לעדכן, נסי שוב');
      }
    } catch {
      setNote('לא הצלחתי לעדכן, נסי שוב');
    }
    setBusy(false);
  }

  return (
    <section className="content-panel">
      <div className="parent-head" style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: '1.15rem' }}>התאמת מטבעות{childName ? ` · ${childName}` : ''}</h2>
      </div>
      <p className="content-hint">אפשר להוסיף או להפחית מטבעות ידנית (למשל תיקון או פרס מיוחד).</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700 }}>
        <CoinIcon /> <span>{balance}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400 }}>מטבעות כרגע</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {[25, 50, 100, 150, 300].map((n) => (
          <button key={n} type="button" onClick={() => setAmount(n)}
            style={{
              padding: '4px 12px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${amount === n ? 'var(--brand, #FF2A85)' : 'var(--line)'}`,
              background: amount === n ? 'rgba(255,42,133,0.12)' : 'transparent',
              color: amount === n ? 'var(--brand, #FF2A85)' : 'var(--muted)',
              fontWeight: amount === n ? 700 : 400,
            }}>{n}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" inputMode="numeric" value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          disabled={busy} aria-label="כמות מטבעות"
          style={{ width: 90, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', textAlign: 'center', fontSize: '1rem' }} />
        <button type="button" className="flag-btn approve" disabled={busy} onClick={() => apply(1)}>+ הוספה</button>
        <button type="button" className="flag-btn reject" disabled={busy} onClick={() => apply(-1)}>- הפחתה</button>
      </div>

      {note && <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: '0.9rem' }}>{note}</div>}
    </section>
  );
}
