import { NextResponse } from 'next/server';
import { getDailyLesson, composeFocus, getChildProfileById, levelFromXp } from '@/lib/db';
import { selectedChildId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const focus = searchParams.get('focus');
  const topic = searchParams.get('topic');
  const more = searchParams.get('more') === '1'; // extra-practice: re-serve solved questions
  const id = selectedChildId();
  const child = id ? await getChildProfileById(id) : null;
  const grade = child?.grade ?? 'grade_3';
  const lesson = focus
    ? await composeFocus(grade, focus, id ?? undefined, topic ?? undefined, more)
    : await getDailyLesson(grade, id ?? undefined);
  // Starting difficulty from the child's level (placement seeds this), 1-5.
  const level = child ? Math.min(5, Math.max(1, levelFromXp(child.xp).level)) : 1;
  return NextResponse.json({ lesson, coins: child?.coins ?? null, name: child?.name ?? null, level });
}
