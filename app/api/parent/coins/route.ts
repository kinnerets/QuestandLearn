import { NextResponse } from 'next/server';
import { adjustChildCoins } from '@/lib/db';
import { parentUnlocked } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Parent-only: adjust a child's coin balance by `delta` (positive grants,
 *  negative deducts). Guarded by the parent lock. Returns the new balance. */
export async function POST(req: Request) {
  if (!parentUnlocked()) return NextResponse.json({ ok: false, reason: 'locked' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const childId = typeof b?.childId === 'string' ? b.childId : '';
  const delta = Number(b?.delta);
  if (!childId || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ ok: false, reason: 'bad-input' }, { status: 400 });
  }
  // Sanity clamp so a fat-fingered value can't do something wild.
  const clamped = Math.max(-100000, Math.min(100000, Math.round(delta)));
  const coins = await adjustChildCoins(childId, clamped);
  if (coins === null) return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 });
  return NextResponse.json({ ok: true, coins });
}
