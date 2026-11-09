import { NextResponse } from 'next/server';
import { seedEnglishTest } from '@/lib/db';
import { parentUnlocked } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Parent-only: load Lia's English test practice into the bank (idempotent). */
export async function POST() {
  if (!parentUnlocked()) return NextResponse.json({ ok: false, reason: 'locked' }, { status: 403 });
  const res = await seedEnglishTest();
  if (!res.ok) return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 });
  return NextResponse.json(res);
}
