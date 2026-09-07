'use client';

import { useEffect, useState } from 'react';
import { Section } from './Section';
import { FlagIcon } from '@/components/icons';

interface Chat { id: string; childName: string; question: string; reply: string; when: string; flagged: boolean }

function whenLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) + ' ' +
    d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function CapiLogPanel({ childId }: { childId?: string }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!childId) return;
    setLoaded(false);
    fetch(`/api/parent/capi-log?childId=${encodeURIComponent(childId)}`)
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.chats)) setChats(j.chats); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [childId]);

  if (!childId || !loaded) return null;

  const flaggedCount = chats.filter((c) => c.flagged).length;

  return (
    <Section title="שיחות עם קפי" count={chats.length || undefined}
      hint="מה הבת שאלה את קפי לאחרונה. קפי מכוון ללמידה ולא מוסר תשובות לשיעורי בית.">
      {chats.length === 0 && (
        <p className="content-hint">עדיין אין שיחות לבת הזו. אם היא כן שוחחה עם קפי ולא מופיע כאן כלום, ודאי שהרצת את supabase/capi_chats.sql.</p>
      )}
      {flaggedCount > 0 && (
        <div className="capi-alert">
          <FlagIcon />
          {flaggedCount === 1 ? 'שאלה אחת נראתה כמו שיעורי בית' : `${flaggedCount} שאלות נראו כמו שיעורי בית`} - מסומנות למטה
        </div>
      )}
      <div className="capi-log">
        {chats.map((c) => (
          <div key={c.id} className={`capi-log-item${c.flagged ? ' flagged' : ''}`}>
            <div className="capi-log-when">
              {whenLabel(c.when)}
              {c.flagged && <span className="capi-log-flag"><FlagIcon /> נראה כמו שיעורי בית</span>}
            </div>
            <div className="capi-log-q">{c.question}</div>
            <div className="capi-log-a">{c.reply}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
