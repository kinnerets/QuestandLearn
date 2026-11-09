'use client';

import { useState } from 'react';

const LINKS = [
  { label: 'אוצר מילים', id: 'c0000005-0000-4000-8000-000000000001' },
  { label: 'מספרים', id: 'c0000005-0000-4000-8000-000000000002' },
  { label: 'חודשים ועונות', id: 'c0000005-0000-4000-8000-000000000003' },
  { label: 'דקדוק To Be', id: 'c0000005-0000-4000-8000-000000000004' },
];

/** One tap loads Lia's English test practice into the question bank - no SQL. */
export function EnglishSeedPanel() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ topic: string; inserted: number }[] | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/parent/seed-english', { method: 'POST' });
      const j = await r.json();
      if (j?.ok && Array.isArray(j.added)) setDone(j.added);
      else setErr('לא הצליח להיטען, נסי שוב בעוד רגע');
    } catch {
      setErr('לא הצליח להיטען, נסי שוב בעוד רגע');
    }
    setBusy(false);
  }

  return (
    <section className="content-panel">
      <div className="parent-head" style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: '1.15rem' }}>תרגול אנגלית למבחן של ליה 🇬🇧</h2>
      </div>
      <p className="content-hint">
        טעינה חד-פעמית של כל התרגול למבחן (אוצר מילים, מספרים, חודשים ועונות, ודקדוק To Be) ישר לאפליקציה. אפשר ללחוץ שוב בלי לדאוג - לא ייווצרו כפילויות.
      </p>

      {!done && (
        <button className="cta" onClick={load} disabled={busy} style={{ marginTop: 4 }}>
          {busy ? 'טוען…' : 'טען את התרגול'}
        </button>
      )}

      {err && <div className="report-empty" style={{ marginTop: 8 }}>{err}</div>}

      {done && (
        <div style={{ marginTop: 6 }}>
          <div className="report-empty" style={{ color: 'var(--ok, #1f8f6a)' }}>
            נטען בהצלחה ✓ {done.map((d) => `${d.topic}${d.inserted ? ` (${d.inserted})` : ' (כבר היה)'}`).join(' · ')}
          </div>
          <p className="content-hint" style={{ marginTop: 10 }}>
            ליה יכולה לתרגל עכשיו: מפת הנושאים ← אנגלית. או קישורים ישירים (ודאי שליה היא הפרופיל הנבחר):
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {LINKS.map((l) => (
              <a key={l.id} href={`/exercise?focus=english&topic=${l.id}`}
                style={{ fontWeight: 700, color: 'var(--brand, #FF2A85)', textDecoration: 'none' }}>
                ◂ {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
