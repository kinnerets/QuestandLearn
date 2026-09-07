import { NextResponse } from 'next/server';
import { getChildInterests, setChildInterests } from '@/lib/db';
import { parentUnlocked } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Read one child's interests (parent view). */
export async function GET(req: Request) {
  if (!parentUnlocked()) return NextResponse.json({ ok: false, interests: [] });
  const childId = new URL(req.url).searchParams.get('childId');
  if (!childId) return NextResponse.json({ ok: true, interests: [] });
  return NextResponse.json({ ok: true, interests: await getChildInterests(childId) });
}

/** Replace a child's interests - used by the parent to remove one she added. */
export async function POST(req: Request) {
  if (!parentUnlocked()) return NextResponse.json({ ok: false, reason: 'locked' });
  const b = await req.json().catch(() => null);
  const childId = b?.childId as string | undefined;
  const interests = Array.isArray(b?.interests) ? (b.interests as unknown[]).map(String) : [];
  if (!childId) return NextResponse.json({ ok: false, reason: 'no-child' });
  return NextResponse.json({ ok: await setChildInterests(childId, interests) });
}
