import { NextResponse } from 'next/server';
import { ensureGlobalBuffer, thinTopicCount, revalidateExisting, purgeStaleFlagged } from '@/lib/generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // several sequential generations per invocation

/**
 * Background top-up (Vercel Cron) that fills the question bank on its own — no
 * parent action ever. Each invocation fills a batch of the thinnest topics, then
 * if any topics still need filling it chains a fresh invocation of itself, so one
 * nightly trigger cascades until the whole catalogue is healthy and then stops.
 * Protected by CRON_SECRET when set; Vercel's cron requests carry it automatically.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    }
  }

  // Fill as many topics as fit in the time budget this invocation.
  const result = await ensureGlobalBuffer(6);
  // Also re-check a few already-live topics against the hardened rules and hide
  // any that fail (self-cleanup of past output). Bounded to stay in the budget.
  const revalidated = await revalidateExisting(4);
  // Auto-clear the parent's review pile: drop questions left flagged over a week.
  const purged = await purgeStaleFlagged(7);
  const remaining = await thinTopicCount();

  // Self-chain: if we made progress and topics still need filling, kick the next
  // batch in a fresh invocation. Guarded by inserted>0 so it stops once healthy.
  if (remaining > 0 && result.inserted > 0) {
    try {
      const origin = new URL(req.url).origin;
      const headers: Record<string, string> = secret ? { authorization: `Bearer ${secret}` } : {};
      // Dispatch the next run without waiting for it to finish (cap the wait so
      // this invocation returns promptly while the request is on its way).
      await Promise.race([
        fetch(`${origin}/api/cron/refill`, { headers }).catch(() => {}),
        new Promise((r) => setTimeout(r, 800)),
      ]);
    } catch { /* best-effort chaining */ }
  }

  return NextResponse.json({ ok: true, ...result, remaining, revalidated, purged });
}
