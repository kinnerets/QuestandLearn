import { getSupabase } from './supabaseClient';
import { sm2, qualityFrom, updateMastery } from './composer';
import { SUBJECT_LABEL, SUBJECT_KIND, SENSITIVE_SUBJECTS, subjectsForInterests } from './constants';
import type { AvatarConfig, StationKind, Subject } from './types';

export interface AttemptInput {
  questionId: string;
  topicId: string;
  isCorrect: boolean;
  misconception?: string | null;
  hintsUsed?: number;
  chosenAnswer?: unknown;
}

export interface ChildProfile {
  id: string;
  name: string;
  grade: string | null;
  coins: number;
  streak: number;
  xp: number;
  avatar: AvatarConfig;
  goalMinutes: number;
}

export interface DbAcademicStation {
  kind: 'core' | 'lang' | 'future';
  subject: string;
  topicId: string;
  questionId: string;
  title: string;
  subtitle: string;
  minutes: number;
  difficulty: number;
  tag: string;
  stem: string;
  qtype: 'multiple_choice' | 'true_false' | 'type_in';
  hint: string;
  hint2?: string;
  explanation?: string;
  choices: { id: string; text: string; misconception?: string }[];
  correctId: string;
  answers?: string[];
  coins: number;
}

export interface DbLeadStation {
  kind: 'lead';
  subject: string;
  topicId: string;
  questionId: string;
  order: number;
  title: string;
  subtitle: string;
  minutes: number;
  prompt: string;
  note: string;
  choices: { id: string; label: string; icon: 'star' | 'home' | 'ear' }[];
}

export type DbStation = DbAcademicStation | DbLeadStation;

// The daily journey rotates day-to-day through each slot's candidate subjects
// (whichever have content), so the mix changes and breadth is covered across
// the week. Leadership is NOT here - it lives in its own reflective area
// ("אי המצפן", /compass), which is not scored by accuracy.
const DAILY_SLOTS: { kind: StationKind; subjects: Subject[] }[] = [
  { kind: 'core', subjects: ['math', 'geometry', 'hebrew', 'bible'] },
  { kind: 'lang', subjects: ['arabic', 'english'] },
  { kind: 'future', subjects: ['future_skills', 'science', 'geography', 'gifted'] },
];

// Leadership topic ids are excluded from academic accuracy/catalog.
const LEADERSHIP_SUBJECT = 'leadership';

interface TopicRow { id: string; subject: string; sub_topic: string; grade: string; order_index?: number }
interface QRow { id: string; topic_id: string; type: string; difficulty: number; payload: Record<string, unknown> }

/** Days since the year start - stable within a day, changes daily. */
function daySeed(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

// Short-lived in-memory cache of the (heavy) content bank, keyed by grade. It's
// read on almost every screen and changes rarely, so a few seconds of caching
// removes most of the per-tap delay. New generated content shows within the TTL.
const _bankCache = new Map<string, { at: number; data: { topics: TopicRow[]; qByTopic: Map<string, QRow[]> } }>();
const BANK_TTL_MS = 45_000;

/** Fetch every topic + question available to a grade (grade-specific + shared). */
async function fetchBank(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  grade: string,
): Promise<{ topics: TopicRow[]; qByTopic: Map<string, QRow[]> }> {
  const cached = _bankCache.get(grade);
  if (cached && Date.now() - cached.at < BANK_TTL_MS) return cached.data;
  const { data: topics } = await sb
    .from('curriculum_topics')
    .select('id,subject,sub_topic,grade,order_index')
    .in('grade', [grade, 'enrichment']);
  const list = (topics ?? []) as TopicRow[];
  const qByTopic = new Map<string, QRow[]>();
  if (list.length) {
    const { data: qs } = await sb
      .from('questions_bank')
      .select('id,topic_id,type,difficulty,payload')
      .in('topic_id', list.map((t) => t.id))
      .neq('verification_status', 'auto_flagged')   // hide questions flagged for parent review
      .order('difficulty', { ascending: true })
      .order('id', { ascending: true });
    for (const q of (qs ?? []) as QRow[]) {
      const arr = qByTopic.get(q.topic_id) ?? [];
      arr.push(q);
      qByTopic.set(q.topic_id, arr);
    }
  }
  const data = { topics: list, qByTopic };
  _bankCache.set(grade, { at: Date.now(), data });
  return data;
}

function buildStation(kind: StationKind, subject: string, topic: TopicRow, q: QRow): DbStation {
  const p = q.payload;
  const subtitle = SUBJECT_LABEL[subject] ?? '';
  if (kind === 'lead') {
    return {
      kind: 'lead', subject, topicId: topic.id, questionId: q.id, order: Number(topic.order_index ?? 0),
      title: topic.sub_topic, subtitle, minutes: 1,
      prompt: String(p.prompt), note: String(p.note),
      choices: (p.options ?? p.choices) as DbLeadStation['choices'],
    };
  }
  const hints = Array.isArray(p.hints) ? (p.hints as string[]) : [];
  const common = {
    kind, subject, topicId: topic.id, questionId: q.id, title: topic.sub_topic, subtitle, minutes: 2,
    difficulty: Number(q.difficulty ?? 1),
    tag: String(p.tag ?? ''), stem: String(p.stem),
    hint: String(p.hint ?? hints[0] ?? ''),
    hint2: p.hint2 ? String(p.hint2) : hints[1],
    explanation: p.explanation ? String(p.explanation) : undefined,
    coins: Number(p.coins ?? 10),
  };
  const qtype = String(q.type ?? 'multiple_choice');

  // Fill-in: the child types the answer; grade against a list of accepted forms.
  if (qtype === 'type_in') {
    const raw = Array.isArray(p.answers) ? (p.answers as unknown[]) : [p.answer];
    const answers = raw.filter((a) => a != null).map((a) => String(a));
    return { ...common, qtype: 'type_in', choices: [], correctId: '', answers };
  }

  // True/false: a fixed two-option question (order stays נכון → לא נכון).
  if (qtype === 'true_false') {
    const yes = p.answer === true || p.answer === 'true' || p.correct_choice_id === 't';
    return {
      ...common, qtype: 'true_false',
      choices: [{ id: 't', text: 'נכון' }, { id: 'f', text: 'לא נכון' }],
      correctId: yes ? 't' : 'f',
    };
  }

  // Multiple choice (default). Shuffle so the correct answer isn't always first.
  const choices = shuffle((p.choices as DbAcademicStation['choices']) ?? []);
  return { ...common, qtype: 'multiple_choice', choices, correctId: String(p.correct_choice_id) };
}

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CHILD_COLUMNS =
  'id,display_name,grade_level,quest_coins,current_streak,total_xp,avatar_config,daily_goal_minutes';

function toChild(data: Record<string, unknown>): ChildProfile {
  return {
    id: data.id as string,
    name: data.display_name as string,
    grade: (data.grade_level as string) ?? null,
    coins: (data.quest_coins as number) ?? 0,
    streak: (data.current_streak as number) ?? 0,
    xp: (data.total_xp as number) ?? 0,
    avatar: data.avatar_config as AvatarConfig,
    goalMinutes: (data.daily_goal_minutes as number) ?? 15,
  };
}

/**
 * XP → level with a gentle increasing curve: early levels come fast (motivating),
 * later ones cost more so a "level" stays meaningful over weeks. Level L→L+1 needs
 * 100 + (L-1)·40 points. (A perfect day is ~150-185 pts → a level early on, slowing
 * to a level every few days later.)
 */
export const XP_PER_LEVEL = 120; // legacy constant, no longer the level size
const LEVEL_BASE = 100, LEVEL_STEP = 40;
function xpToNext(level: number): number { return LEVEL_BASE + (level - 1) * LEVEL_STEP; }
/** Cumulative points needed to REACH a given level. */
export function xpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}
export function levelFromXp(xp: number) {
  let level = 1, remaining = Math.max(0, xp), need = xpToNext(1);
  while (remaining >= need) { remaining -= need; level += 1; need = xpToNext(level); }
  return { level, inLevel: remaining, need };
}

/** Add XP to a child (best-effort read-modify-write). */
export async function addXp(childId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data } = await sb.from('users').select('total_xp').eq('id', childId).maybeSingle();
    const cur = Number(data?.total_xp ?? 0);
    await sb.from('users').update({ total_xp: cur + amount }).eq('id', childId);
  } catch { /* best effort */ }
}

/** All children in the family, oldest grade last - for the profile picker. */
export async function getChildren(): Promise<ChildProfile[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('users')
      .select(CHILD_COLUMNS)
      .eq('role', 'child')
      .order('grade_level', { ascending: true });
    if (error || !data?.length) return null;
    return data.map(toChild);
  } catch {
    return null;
  }
}

/** Record one Capi chat exchange for parent visibility. Best-effort - if the
 *  table isn't there yet, it's silently skipped. */
export async function logCapiChat(childId: string, question: string, reply: string, flagged = false): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('capi_chats').insert({
      child_id: childId, question: question.slice(0, 1000), reply: reply.slice(0, 2000), flagged,
    });
  } catch { /* table/column may not exist yet */ }
}

export interface CapiChat { id: string; childName: string; question: string; reply: string; when: string; flagged: boolean }

/** Recent Capi conversations (optionally for one child) - for the parent area. */
export async function getCapiChats(childId?: string, limit = 40): Promise<CapiChat[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    let q = sb.from('capi_chats').select('id,child_id,question,reply,created_at,flagged')
      .order('created_at', { ascending: false }).limit(limit);
    if (childId) q = q.eq('child_id', childId);
    const { data, error } = await q;
    if (error) return []; // table/column not there yet
    if (!data?.length) return [];
    const ids = [...new Set(data.map((r) => r.child_id as string))];
    const { data: kids } = await sb.from('users').select('id,display_name').in('id', ids);
    const names = new Map((kids ?? []).map((k) => [k.id as string, k.display_name as string]));
    return data.map((r) => ({
      id: r.id as string, childName: names.get(r.child_id as string) ?? 'ילדה',
      question: String(r.question ?? ''), reply: String(r.reply ?? ''), when: r.created_at as string,
      flagged: r.flagged === true,
    }));
  } catch {
    return null;
  }
}

/** Start of the current week (Sunday 00:00 UTC) as an ISO string. */
function weekStartISO(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  return d.toISOString();
}

/** Whole days remaining until the week resets (next Sunday 00:00 UTC). Min 1 while the week is live. */
function weekDaysLeft(): number {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7); // next Sunday 00:00 UTC
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

const TEAM_PER_CHILD = 20; // each sister's fair share of the weekly team goal
const TEAM_REWARD_COINS = 30; // bonus coins each sister gets when the team finishes

export interface TeamChallenge {
  target: number;        // total across the team (perChild × number of kids)
  perChild: number;      // each child's equal share
  correct: number;       // sum of capped contributions (so one can't carry the whole thing)
  done: boolean;
  daysLeft: number;
  reward: number;        // coins each sister earns on completion
  claimed: boolean;      // whether this week's reward was already collected
  byChild: { name: string; correct: number; done: boolean }[];
}

/**
 * Co-Op: a shared weekly goal both sisters push toward together - but made fair.
 * Each sister has an equal share (TEAM_PER_CHILD) and her contribution counts
 * only up to that share, so the team can finish only when *both* pull their
 * weight. Returns null unless there are at least two kids.
 */
export async function getTeamChallenge(): Promise<TeamChallenge | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: kids } = await sb.from('users').select('id,display_name').eq('role', 'child');
    if (!kids || kids.length < 2) return null; // a team needs at least two
    const ids = kids.map((k) => k.id as string);
    const { data: rows } = await sb
      .from('attempts_log').select('user_id')
      .eq('is_correct', true).gte('created_at', weekStartISO()).in('user_id', ids);
    const counts = new Map<string, number>();
    for (const r of rows ?? []) counts.set(r.user_id as string, (counts.get(r.user_id as string) ?? 0) + 1);
    const perChild = TEAM_PER_CHILD;
    const byChild = kids.map((k) => {
      const raw = counts.get(k.id as string) ?? 0;
      return { name: k.display_name as string, correct: raw, done: raw >= perChild };
    });
    // Cap each contribution at her share so neither sister can complete the goal alone.
    const correct = byChild.reduce((s, c) => s + Math.min(c.correct, perChild), 0);
    const target = perChild * kids.length;
    const done = byChild.every((c) => c.done);
    let claimed = false;
    if (done) {
      try {
        const { data: rr } = await sb.from('team_rewards').select('week_start').eq('week_start', weekStartISO()).maybeSingle();
        claimed = !!rr;
      } catch { claimed = false; }
    }
    return {
      target, perChild, correct, done, daysLeft: weekDaysLeft(),
      reward: TEAM_REWARD_COINS, claimed, byChild,
    };
  } catch {
    return null;
  }
}

/**
 * Collect this week's team reward once both sisters have finished their share.
 * Reserves the week (unique week_start) before granting so it can't double-pay,
 * then adds bonus coins to every child. Best-effort; needs the team_rewards table.
 */
export async function claimTeamReward(): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'no-db' };
  try {
    const tc = await getTeamChallenge();
    if (!tc) return { ok: false, reason: 'no-team' };
    if (!tc.done) return { ok: false, reason: 'not-done' };
    if (tc.claimed) return { ok: false, reason: 'claimed' };
    const week = weekStartISO();
    // Reserve first: the unique week_start makes a second claim fail cleanly.
    const { error: insErr } = await sb.from('team_rewards').insert({ week_start: week });
    if (insErr) {
      // 23505 = unique violation → already claimed this week (coins already given).
      // Anything else (e.g. the table doesn't exist) is a real error: DON'T mark
      // the reward collected, so no coins are silently skipped.
      if ((insErr as { code?: string }).code === '23505') return { ok: false, reason: 'already' };
      return { ok: false, reason: 'error' };
    }
    const { data: kids } = await sb.from('users').select('id,quest_coins').eq('role', 'child');
    if (!kids?.length) return { ok: false, reason: 'error' };
    for (const k of kids) {
      const now = (k.quest_coins as number) ?? 0;
      await sb.from('users').update({ quest_coins: now + TEAM_REWARD_COINS }).eq('id', k.id);
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** A single child by id (from the selected-profile cookie). */
export async function getChildProfileById(id: string): Promise<ChildProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('users')
      .select(CHILD_COLUMNS)
      .eq('id', id)
      .eq('role', 'child')
      .maybeSingle();
    if (error || !data) return null;
    return toChild(data);
  } catch {
    return null;
  }
}

/** First child - fallback when no profile has been selected yet. */
export async function getChildProfile(): Promise<ChildProfile | null> {
  const all = await getChildren();
  return all?.[0] ?? null;
}

export interface SubjectMastery {
  subject: string;
  subTopic: string;
  mastery: number;   // 0..1
  attempts: number;
}

export interface ChildReport {
  activeDays: number;   // distinct days with activity, last 7 days
  answered: number;     // questions answered, last 7 days
  correct: number;
  accuracy: number;     // 0..1
  learnMinutes: number; // estimated active learning minutes, last 7 days
  subjects: SubjectMastery[];
  misconceptions: string[];
}

/** Weekly parent report for one child, aggregated from attempts + mastery. */
export async function getChildReport(childId: string): Promise<ChildReport | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    // Leadership "deposits" aren't graded - keep them out of academic accuracy.
    const { data: leadTopics } = await sb
      .from('curriculum_topics').select('id').eq('subject', LEADERSHIP_SUBJECT);
    const leadIds = new Set((leadTopics ?? []).map((t) => t.id as string));

    const { data: attempts } = await sb
      .from('attempts_log')
      .select('is_correct,created_at,topic_id')
      .eq('user_id', childId)
      .gte('created_at', since);
    const graded = (attempts ?? []).filter((a) => !leadIds.has(a.topic_id as string));
    const answered = graded.length;
    const correct = graded.filter((a) => a.is_correct).length;
    const activeDays = new Set((attempts ?? []).map((a) => String(a.created_at).slice(0, 10))).size;

    // Estimate active learning time: sum gaps between consecutive answers, but
    // treat a gap over 3 minutes as a break (not counted), plus a little for the
    // start/end of each sitting.
    const times = (attempts ?? []).map((a) => new Date(a.created_at as string).getTime()).sort((x, y) => x - y);
    let ms = 0;
    for (let i = 1; i < times.length; i++) ms += Math.min(times[i] - times[i - 1], 180_000);
    if (times.length) ms += 45_000;
    const learnMinutes = Math.round(ms / 60_000);

    const { data: mastery } = await sb
      .from('user_mastery')
      .select('topic_id,mastery_score,attempts_count,misconception_tags')
      .eq('user_id', childId);

    let subjects: SubjectMastery[] = [];
    const misc = new Set<string>();
    if (mastery?.length) {
      const ids = mastery.map((m) => m.topic_id);
      const { data: topics } = await sb
        .from('curriculum_topics')
        .select('id,subject,sub_topic')
        .in('id', ids);
      const byId = new Map((topics ?? []).map((t) => [t.id, t]));
      subjects = mastery
        .map((m) => {
          const t = byId.get(m.topic_id);
          (m.misconception_tags ?? []).forEach((x: string) => misc.add(x));
          return {
            subject: (t?.subject as string) ?? '',
            subTopic: (t?.sub_topic as string) ?? '',
            mastery: Number(m.mastery_score),
            attempts: Number(m.attempts_count),
          };
        })
        .sort((a, b) => a.mastery - b.mastery);
    }

    return {
      activeDays, answered, correct,
      accuracy: answered ? correct / answered : 0,
      learnMinutes,
      subjects, misconceptions: [...misc],
    };
  } catch {
    return null;
  }
}

/** Persist a new avatar for a child. Best-effort. */
export async function saveAvatar(childId: string, config: AvatarConfig): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb
      .from('users')
      .update({ avatar_config: config })
      .eq('id', childId)
      .eq('role', 'child');
    return !error;
  } catch {
    return false;
  }
}

/**
 * Compose the day's journey: 4 slots (core / lang / enrichment / leadership).
 * Each slot rotates day-to-day through its candidate subjects that have
 * content, so the subject mix changes daily and breadth is covered across the
 * week. `round` (1-based) shifts both the subject and the question within a
 * topic, so "עוד מסע" serves fresh, gently harder material.
 */
// ─────────────────────────── Avatar shop ───────────────────────────
export interface AvatarItem {
  id: string;
  slot: string;          // 'accessory' | 'hairstyle' | ...
  value: string;         // config value this item unlocks (accessory_id / hairstyle_id)
  label: string;
  emoji: string;
  cost: number;
  owned: boolean;
}
export interface AvatarShop { items: AvatarItem[]; coins: number }

function mapAvatarLayer(row: { id: string; slot: string; svg_layer: unknown; cost_coins: number | null }, owned: Set<string>): AvatarItem {
  const layer = (row.svg_layer ?? {}) as { value?: string; label?: string; emoji?: string };
  return {
    id: row.id,
    slot: row.slot,
    value: layer.value ?? '',
    label: layer.label ?? row.slot,
    emoji: layer.emoji ?? '✨',
    cost: row.cost_coins ?? 0,
    owned: owned.has(row.id),
  };
}

/** Purchasable avatar items (unlock_type='coins') with this child's ownership. */
export async function getAvatarShop(childId: string): Promise<AvatarShop | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const [{ data: items }, { data: owned }, child] = await Promise.all([
      sb.from('avatar_items').select('id,slot,svg_layer,cost_coins').eq('unlock_type', 'coins').order('cost_coins', { ascending: true }),
      sb.from('user_avatar_items').select('item_id').eq('user_id', childId),
      getChildProfileById(childId),
    ]);
    if (!items) return null;
    const ownedSet = new Set((owned ?? []).map((r) => r.item_id as string));
    return {
      items: items.map((r) => mapAvatarLayer(r, ownedSet)),
      coins: child?.coins ?? 0,
    };
  } catch {
    return null;
  }
}

/** The set of premium item *values* this child owns (for gating the editor). */
export async function getOwnedItemValues(childId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from('user_avatar_items')
      .select('avatar_items(svg_layer)')
      .eq('user_id', childId);
    if (!data) return [];
    return data
      .map((r) => {
        const it = (r as { avatar_items?: { svg_layer?: { value?: string } } }).avatar_items;
        return it?.svg_layer?.value ?? null;
      })
      .filter((v): v is string => !!v);
  } catch {
    return [];
  }
}

export interface BuyResult { ok: boolean; reason?: string; coins?: number }

/** Buy an avatar item: verify affordability + not already owned, deduct coins. */
export async function buyAvatarItem(childId: string, itemId: string): Promise<BuyResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'no-db' };
  try {
    const child = await getChildProfileById(childId);
    if (!child) return { ok: false, reason: 'no-child' };
    const { data: item } = await sb
      .from('avatar_items')
      .select('id,cost_coins,unlock_type')
      .eq('id', itemId)
      .maybeSingle();
    if (!item || item.unlock_type !== 'coins') return { ok: false, reason: 'no-item' };

    const { data: already } = await sb
      .from('user_avatar_items')
      .select('item_id')
      .eq('user_id', child.id).eq('item_id', itemId)
      .limit(1);
    if (already?.length) return { ok: false, reason: 'owned' };

    const cost = item.cost_coins ?? 0;
    if (child.coins < cost) return { ok: false, reason: 'not-enough' };

    const left = child.coins - cost;
    await sb.from('users').update({ quest_coins: left }).eq('id', child.id);
    const { error } = await sb.from('user_avatar_items').insert({ user_id: child.id, item_id: itemId });
    if (error) {
      // roll the coins back if the ownership row failed to persist
      await sb.from('users').update({ quest_coins: child.coins }).eq('id', child.id);
      return { ok: false, reason: 'insert-failed' };
    }
    return { ok: true, coins: left };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

// ── Weighted Composer signals ──
interface MasterySig { mastery: number; overdueDays: number; misconceptions: number }

/** Per-topic mastery signals for this child (SM-2 + misconceptions). */
async function loadMasterySignals(
  sb: NonNullable<ReturnType<typeof getSupabase>>, childId: string, topicIds: string[],
): Promise<Map<string, MasterySig>> {
  const map = new Map<string, MasterySig>();
  try {
    const { data } = await sb
      .from('user_mastery')
      .select('topic_id,mastery_score,next_review_at,misconception_tags')
      .eq('user_id', childId).in('topic_id', topicIds);
    const now = Date.now();
    for (const r of data ?? []) {
      const overdue = r.next_review_at ? (now - new Date(r.next_review_at as string).getTime()) / 86_400_000 : 0;
      map.set(r.topic_id as string, {
        mastery: Number(r.mastery_score ?? 0),
        overdueDays: overdue,
        misconceptions: Array.isArray(r.misconception_tags) ? (r.misconception_tags as unknown[]).length : 0,
      });
    }
  } catch { /* signals are best-effort */ }
  return map;
}

/**
 * Priority score for a topic: weak mastery, due reviews, and lingering
 * misconceptions all raise it. A small day-stable jitter breaks ties so the mix
 * still rotates. `interestBoost` nudges subjects the child said she loves.
 * (parent_directive weight = 0 until built.)
 */
function topicPriority(sig: MasterySig | undefined, jitter: number, interestBoost = 0): number {
  const gap = 1 - (sig?.mastery ?? 0);                                   // weak → high (0..1)
  const review = sig ? Math.max(0, Math.min(1, sig.overdueDays / 3)) : 0; // overdue up to 3d → 0..1
  const misc = sig ? Math.min(0.4, sig.misconceptions * 0.2) : 0;        // repeated misconceptions
  return 0.5 * gap + 0.35 * review + misc + interestBoost + jitter;
}

// Soft gating: a topic whose prerequisite (the previous sub-topic in the same
// subject, by order_index) isn't yet mastered gets its priority *reduced* - not
// locked. So the foundation tends to come first, but an overdue review or a
// strong interest can still surface an advanced topic. When order_index isn't
// populated (all equal), no topic has an earlier sibling, so gating stays off.
const GATE_OPEN = 0.6;   // prereq mastery at/above this → gate fully open (no penalty)
const GATE_WEIGHT = 0.6; // strongest push-down when the prereq is untouched

function prereqPenalty(
  t: TopicRow, sigs: Map<string, MasterySig>, bySubject: Map<string, TopicRow[]>,
): number {
  const sibs = bySubject.get(t.subject) ?? [];
  const myOrder = Number(t.order_index ?? 0);
  let prereq: TopicRow | undefined;
  for (const s of sibs) {
    const o = Number(s.order_index ?? 0);
    if (o < myOrder && (!prereq || o > Number(prereq.order_index ?? 0))) prereq = s;
  }
  if (!prereq) return 0; // foundational topic - nothing gates it
  const pm = sigs.get(prereq.id)?.mastery ?? 0;
  if (pm >= GATE_OPEN) return 0;
  return GATE_WEIGHT * ((GATE_OPEN - pm) / GATE_OPEN); // 0..GATE_WEIGHT
}

/** This child's interest ids (defensive: empty if the column isn't there yet). */
export async function getChildInterests(childId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('users').select('interests').eq('id', childId).maybeSingle();
    if (error || !data) return [];
    const raw = (data as { interests?: unknown }).interests;
    return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** Save this child's chosen interests. Returns false if the column is missing. */
export async function setChildInterests(childId: string, interests: string[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const clean = [...new Set(interests.map((s) => String(s)))].slice(0, 20);
    const { error } = await sb.from('users').update({ interests: clean }).eq('id', childId);
    return !error;
  } catch {
    return false;
  }
}

/** Subjects a parent asked to emphasize for this child (a weekly focus). */
export async function getParentFocus(childId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('users').select('parent_focus').eq('id', childId).maybeSingle();
    if (error || !data) return [];
    const raw = (data as { parent_focus?: unknown }).parent_focus;
    return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** Parent sets the emphasized subjects for this child. */
export async function setParentFocus(childId: string, subjects: string[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const clean = [...new Set(subjects.map((s) => String(s)))].slice(0, 12);
    const { error } = await sb.from('users').update({ parent_focus: clean }).eq('id', childId);
    return !error;
  } catch {
    return false;
  }
}

export async function getDailyLesson(grade = 'grade_3', childId?: string, round = 1): Promise<DbStation[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { topics, qByTopic } = await fetchBank(sb, grade);
    if (!topics.length) return null;
    const seed = daySeed();

    // This child's mastery/review signals drive the weighted pick (Composer).
    const sigs = childId ? await loadMasterySignals(sb, childId, topics.map((t) => t.id)) : new Map<string, MasterySig>();
    const solved = childId ? await solvedQuestionIds(sb, childId) : new Set<string>();
    const jitterFor = (id: string) => ((seed + Number('0x' + id.slice(0, 6))) % 100) / 1000; // 0..0.099, day-stable

    // Interests nudge the mix toward subjects she loves; a parent "weekly focus"
    // nudges harder. Both can surface an enrichment subject into the journey.
    const [interests, focus, focusTopicIds] = childId
      ? await Promise.all([getChildInterests(childId), getParentFocus(childId), getParentFocusTopics(childId)])
      : [[], [], []];
    const likedSubjects = subjectsForInterests(interests);
    const focusSubjects = new Set(focus);
    const focusTopics = new Set(focusTopicIds); // specific sub-topics a parent asked to reinforce
    const boostSubjects = new Set<string>([...likedSubjects, ...focusSubjects]);
    const locked = boostSubjects.size ? await getLockedSubjects(sb) : new Set<string>();
    const boostOf = (subject: string) =>
      (focusSubjects.has(subject) ? 0.55 : 0) + (likedSubjects.has(subject) ? 0.3 : 0);

    // Sub-topics per subject, ordered - drives the soft prerequisite gate.
    const topicsBySubject = new Map<string, TopicRow[]>();
    for (const t of topics) {
      const arr = topicsBySubject.get(t.subject) ?? [];
      arr.push(t);
      topicsBySubject.set(t.subject, arr);
    }
    for (const arr of topicsBySubject.values()) {
      arr.sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
    }

    const stations: DbStation[] = [];
    DAILY_SLOTS.forEach((slot) => {
      // Base candidates for this slot + any interest/focus-matched enrichment
      // subject that has content and isn't parent-locked (surfaced into 'future').
      const subjectPool = new Set<string>(slot.subjects);
      if (slot.kind === 'future') {
        for (const s of boostSubjects) {
          if ((SUBJECT_KIND[s] ?? '') === 'future' && !slot.subjects.includes(s as Subject) && !locked.has(s)) {
            subjectPool.add(s);
          }
        }
      }
      // Every sub-topic of every pool subject competes, so a foundational
      // sub-topic can win over an advanced one within the same subject.
      const candidates = topics.filter(
        (t) => subjectPool.has(t.subject) && (qByTopic.get(t.id)?.length ?? 0) > 0,
      );
      if (!candidates.length) return;
      // Pick the highest-priority topic for THIS child (weak/overdue/misconception/
      // interest first), softly gated so an un-mastered prerequisite pushes an
      // advanced sub-topic down without hard-locking it.
      const topic = candidates
        .map((t) => ({
          t,
          score: topicPriority(sigs.get(t.id), jitterFor(t.id), boostOf(t.subject))
            - prereqPenalty(t, sigs, topicsBySubject)
            + (focusTopics.has(t.id) ? 0.7 : 0), // parent reinforced this exact sub-topic
        }))
        .sort((a, b) => b.score - a.score)[0].t;
      const qs = qByTopic.get(topic.id)!;
      // Prefer a question the child hasn't solved yet; else rotate by day.
      const q = qs.find((x) => !solved.has(x.id)) ?? qs[(seed + round - 1) % qs.length];
      stations.push(buildStation(slot.kind, topic.subject, topic, q));
    });

    // One daily leadership mission - part of the day's requirement but reflective
    // (never scored on accuracy). Rotates through the worlds day to day.
    const leadTopics = topics
      .filter((t) => t.subject === LEADERSHIP_SUBJECT && (qByTopic.get(t.id)?.length ?? 0) > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (leadTopics.length) {
      const lt = leadTopics[(seed + round - 1) % leadTopics.length];
      const lq = qByTopic.get(lt.id)![0];
      stations.push(buildStation('lead', LEADERSHIP_SUBJECT, lt, lq));
    }

    return stations.length ? stations : null;
  } catch {
    return null;
  }
}

export interface NextDaily { subject: string; label: string; topicId?: string; order?: number }

/** The next unfinished topic in today's journey - for chaining sessions. */
export async function getNextDaily(childId: string, grade: string, exclude?: string): Promise<{ next: NextDaily | null; done: boolean }> {
  const [lesson, doneSubjects] = await Promise.all([getDailyLesson(grade, childId), getTodaySubjects(childId)]);
  if (!lesson?.length) return { next: null, done: true };
  const doneSet = new Set(doneSubjects);
  for (const s of lesson) {
    if (!doneSet.has(s.subject) && s.subject !== exclude) {
      return {
        next: {
          subject: s.subject,
          label: SUBJECT_LABEL[s.subject] ?? s.subject,
          topicId: s.kind === 'lead' ? s.topicId : undefined,
          order: s.kind === 'lead' ? s.order : undefined,
        },
        done: false,
      };
    }
  }
  return { next: null, done: true };
}

/** Question ids this child has already answered correctly - never shown again. */
async function solvedQuestionIds(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  childId: string,
): Promise<Set<string>> {
  try {
    const { data } = await sb
      .from('attempts_log')
      .select('question_id')
      .eq('user_id', childId)
      .eq('is_correct', true);
    return new Set((data ?? []).map((r) => r.question_id as string));
  } catch {
    return new Set();
  }
}

/** Base session length. Grade 5 runs longer so the full daily journey
 *  (3 subjects + a leadership moment) lands near the ~30-minute goal; grade 3
 *  stays shorter. The bank holds many more for "עוד תרגול". */
function focusLength(grade: string): number {
  return grade === 'grade_5' ? 8 : 5;
}

/**
 * A focused single-subject session. Serves only questions the child has NOT
 * already solved, length scaled by grade. Returns [] when the subject is fully
 * solved (caller shows a "completed" screen), null on error/no content.
 */
export async function composeFocus(
  grade = 'grade_3', subject = 'math', childId?: string, topicId?: string,
): Promise<DbStation[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { topics, qByTopic } = await fetchBank(sb, grade);
    // Foundational sub-topics first (soft gate): a focus session works through
    // the subject in prerequisite order, so the base comes before the advanced.
    const subjectTopics = topics
      .filter((t) => t.subject === subject && (!topicId || t.id === topicId))
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
    if (!subjectTopics.length) return null;
    const kind = SUBJECT_KIND[subject] ?? 'core';
    const solved = childId ? await solvedQuestionIds(sb, childId) : new Set<string>();

    // Leadership worlds are reflective and repeatable - never filter them as "solved".
    const repeatable = subject === LEADERSHIP_SUBJECT;
    // A valid leadership question has a prompt + choices carrying an icon; skip any
    // malformed (e.g. multiple-choice) rows that would break the leadership view.
    const validLead = (p: Record<string, unknown>) => {
      const opts = (p.options ?? p.choices) as { icon?: string }[] | undefined;
      return !!p.prompt && Array.isArray(opts) && opts.length > 0 && opts.every((o) => !!o?.icon);
    };
    const fresh: { topic: TopicRow; q: QRow }[] = [];
    const review: { topic: TopicRow; q: QRow }[] = [];   // already-solved, kept for padding
    for (const topic of subjectTopics) {
      for (const q of qByTopic.get(topic.id) ?? []) {
        if (repeatable && !validLead(q.payload)) continue; // drop broken lead content
        if (repeatable || !solved.has(q.id)) fresh.push({ topic, q });
        else review.push({ topic, q });
      }
    }
    if (!(qByTopic.size)) return null;   // subject has no content at all
    if (!fresh.length && !review.length) return [];

    // Prefer unsolved questions; if there aren't enough for a full session, pad
    // with already-solved ones (spaced review) so a sitting is never just 1-2.
    const want = focusLength(grade);
    const pool = fresh.length >= want ? fresh.slice(0, want)
      : fresh.length ? [...fresh, ...review].slice(0, want)
        : [];                            // nothing new → let the caller show "done"
    if (!pool.length) return [];

    const stations = pool.map(({ topic, q }) => buildStation(kind, subject, topic, q));
    return stations;
  } catch {
    return null;
  }
}

/**
 * "מסע ההיכרות" - a short entry quiz spanning difficulties and subjects, used to
 * place a child at the right starting level (so strong kids don't grind easy ones).
 */
export async function getPlacementQuestions(grade = 'grade_3'): Promise<DbStation[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { topics, qByTopic } = await fetchBank(sb, grade);
    // Academic only; one representative question per topic, then spread by difficulty.
    const picks: { topic: TopicRow; q: QRow }[] = [];
    for (const t of topics) {
      if (t.subject === LEADERSHIP_SUBJECT) continue;
      const qs = qByTopic.get(t.id) ?? [];
      if (qs.length) picks.push({ topic: t, q: qs[Math.floor(qs.length / 2)] });
    }
    if (!picks.length) return null;
    picks.sort((a, b) => Number(a.q.difficulty ?? 1) - Number(b.q.difficulty ?? 1));
    // Sample up to 8 evenly across the difficulty range for a real ramp.
    const want = Math.min(8, picks.length);
    const step = picks.length / want;
    const chosen: { topic: TopicRow; q: QRow }[] = [];
    for (let i = 0; i < want; i++) chosen.push(picks[Math.floor(i * step)]);
    return chosen.map(({ topic, q }) => buildStation(SUBJECT_KIND[topic.subject] ?? 'core', topic.subject, topic, q));
  } catch {
    return null;
  }
}

/** Map a placement score to a starting level (1-5). Grade 5 gets a small boost. */
export function placementLevel(correct: number, total: number, grade: string): number {
  const pct = total ? correct / total : 0;
  let lvl = pct >= 0.85 ? 4 : pct >= 0.65 ? 3 : pct >= 0.4 ? 2 : 1;
  if (grade === 'grade_5' && lvl < 5) lvl += 1;
  return Math.min(5, Math.max(1, lvl));
}

/** Seed a child's starting level from placement - only if they haven't started yet. */
export async function setPlacementLevel(childId: string, level: number): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const child = await getChildProfileById(childId);
    if (!child) return false;
    if (child.xp > 0) return true; // already placed or practising - never overwrite
    const xp = Math.max(10, xpForLevel(level));
    const { error } = await sb.from('users').update({ total_xp: xp }).eq('id', childId);
    return !error;
  } catch {
    return false;
  }
}

export interface TopicCard {
  id: string;
  subTopic: string;
  accuracy: number;
  answered: number;
  solved: number;
  total: number;
  gated: boolean;    // soft gate: prerequisite not yet mastered (still playable)
  prereq?: string;   // name of the sub-topic to master first
}

/** Have the basics of this sub-topic been reached? (self-contained, no extra query) */
function topicSatisfied(c: { total: number; solved: number; answered: number; accuracy: number }): boolean {
  if (c.total > 0 && c.solved >= c.total) return true;         // fully solved
  return c.answered >= 3 && c.accuracy >= 0.65;                // enough practice, decent accuracy
}

/** Sub-topics within a subject, with per-topic progress - for the drill-down. */
export async function getSubjectTopics(
  grade: string, subject: string, childId: string,
): Promise<{ label: string; topics: TopicCard[] } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { topics, qByTopic } = await fetchBank(sb, grade);
    // Prerequisite order - the soft gate reads the sub-topic just before each one.
    const st = topics
      .filter((t) => t.subject === subject && (qByTopic.get(t.id)?.length ?? 0) > 0)
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
    if (!st.length) return null;

    const { data: attempts } = await sb
      .from('attempts_log')
      .select('topic_id,question_id,is_correct')
      .eq('user_id', childId);
    const tally = new Map<string, { answered: number; correct: number; solved: Set<string> }>();
    for (const a of attempts ?? []) {
      const e = tally.get(a.topic_id as string) ?? { answered: 0, correct: 0, solved: new Set<string>() };
      e.answered += 1;
      if (a.is_correct) { e.correct += 1; e.solved.add(a.question_id as string); }
      tally.set(a.topic_id as string, e);
    }

    const cards: TopicCard[] = st.map((t) => {
      const total = qByTopic.get(t.id)?.length ?? 0;
      const e = tally.get(t.id);
      const answered = e?.answered ?? 0;
      const correct = e?.correct ?? 0;
      return {
        id: t.id, subTopic: t.sub_topic,
        accuracy: answered ? Number((correct / answered).toFixed(2)) : 0,
        answered, solved: e?.solved.size ?? 0, total,
        gated: false,
      };
    });
    // Soft gate: a sub-topic is "gated" when the one before it isn't mastered yet.
    for (let i = 1; i < cards.length; i++) {
      if (!topicSatisfied(cards[i - 1])) {
        cards[i].gated = true;
        cards[i].prereq = cards[i - 1].subTopic;
      }
    }
    return { label: SUBJECT_LABEL[subject] ?? subject, topics: cards };
  } catch {
    return null;
  }
}

export interface SubTopicStat {
  id: string; subTopic: string; accuracy: number; answered: number; solved: number; total: number;
}
export interface SubjectBreakdown {
  subject: string; label: string; kind: StationKind;
  accuracy: number;   // only over practised sub-topics (untrained ones don't count)
  answered: number;
  sub: SubTopicStat[];
}

/** Per-subject → per-sub-topic mastery for one child, in a single pass. Powers
 *  the child's expandable status view and the parent's sub-topic reinforce view. */
export async function getSubjectBreakdown(grade: string, childId: string): Promise<SubjectBreakdown[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { topics, qByTopic } = await fetchBank(sb, grade);
    const { data: attempts } = await sb
      .from('attempts_log').select('topic_id,question_id,is_correct').eq('user_id', childId);
    const tally = new Map<string, { answered: number; correct: number; solved: Set<string> }>();
    for (const a of attempts ?? []) {
      const e = tally.get(a.topic_id as string) ?? { answered: 0, correct: 0, solved: new Set<string>() };
      e.answered += 1;
      if (a.is_correct) { e.correct += 1; e.solved.add(a.question_id as string); }
      tally.set(a.topic_id as string, e);
    }
    const bySubject = new Map<string, TopicRow[]>();
    for (const t of topics) {
      if ((qByTopic.get(t.id)?.length ?? 0) === 0) continue;
      const arr = bySubject.get(t.subject) ?? [];
      arr.push(t);
      bySubject.set(t.subject, arr);
    }
    const locked = await getLockedSubjects(sb);
    const order = ['math', 'geometry', 'hebrew', 'bible', 'arabic', 'english', 'science', 'geography',
      'future_skills', 'economics', 'fashion', 'politics', 'ai', 'philosophy',
      'metacognition', 'geopolitics', 'cognitive_bias', 'epigenetics', 'procrastination',
      'decision_making', 'neuroplasticity', 'financial_literacy', 'gifted'];
    const out: SubjectBreakdown[] = [];
    for (const subject of order) {
      if (locked.has(subject)) continue;
      const ts = bySubject.get(subject);
      if (!ts) continue;
      ts.sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
      const sub: SubTopicStat[] = ts.map((t) => {
        const total = qByTopic.get(t.id)?.length ?? 0;
        const e = tally.get(t.id);
        const answered = e?.answered ?? 0;
        const correct = e?.correct ?? 0;
        return {
          id: t.id, subTopic: t.sub_topic,
          accuracy: answered ? Number((correct / answered).toFixed(2)) : 0,
          answered, solved: e?.solved.size ?? 0, total,
        };
      });
      const ans = sub.reduce((s, x) => s + x.answered, 0);
      const cor = sub.reduce((s, x) => s + Math.round(x.accuracy * x.answered), 0);
      out.push({
        subject, label: SUBJECT_LABEL[subject] ?? subject,
        kind: (SUBJECT_KIND[subject] ?? 'core') as StationKind,
        accuracy: ans ? Number((cor / ans).toFixed(2)) : 0, answered: ans, sub,
      });
    }
    return out;
  } catch {
    return null;
  }
}

/** Recent wrong-answered question stems per topic (last `days` days) - so a
 *  parent sees concrete examples of what to reinforce. Map: topicId → stems. */
export async function getRecentWrongByTopic(childId: string, days = 7): Promise<Record<string, string[]>> {
  const sb = getSupabase();
  if (!sb) return {};
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: rows } = await sb
      .from('attempts_log')
      .select('topic_id,question_id,created_at')
      .eq('user_id', childId).eq('is_correct', false).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(200);
    if (!rows?.length) return {};
    const qids = [...new Set(rows.map((r) => r.question_id as string))].slice(0, 100);
    const { data: qs } = await sb.from('questions_bank').select('id,topic_id,payload').in('id', qids);
    const out: Record<string, string[]> = {};
    const seen = new Set<string>();
    for (const q of qs ?? []) {
      const topicId = q.topic_id as string;
      const stem = String((q.payload as { stem?: string })?.stem ?? '').trim();
      if (!stem) continue;
      const key = topicId + '|' + stem;
      if (seen.has(key)) continue;
      seen.add(key);
      (out[topicId] ??= []);
      if (out[topicId].length < 3) out[topicId].push(stem); // a few examples per topic
    }
    return out;
  } catch {
    return {};
  }
}

/** Topic ids a parent asked to reinforce for this child (defensive: [] if the
 *  column isn't there yet). */
export async function getParentFocusTopics(childId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('users').select('parent_focus_topics').eq('id', childId).maybeSingle();
    if (error || !data) return [];
    const raw = (data as { parent_focus_topics?: unknown }).parent_focus_topics;
    return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** Parent toggles reinforcement of one sub-topic. Returns false if unsupported. */
export async function setParentFocusTopic(childId: string, topicId: string, on: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const current = await getParentFocusTopics(childId);
    const set = new Set(current);
    if (on) set.add(topicId); else set.delete(topicId);
    const { error } = await sb.from('users').update({ parent_focus_topics: [...set].slice(0, 40) }).eq('id', childId);
    return !error;
  } catch {
    return false;
  }
}

// ── End-of-year assessment (מבדק) ──────────────────────────────────────────
export interface AssessmentQuestion {
  id: string; subject: string; subjectLabel: string; tag: string; stem: string;
  choices: { id: string; text: string }[];
}
export interface AssessmentSubjectScore { subject: string; label: string; correct: number; total: number }
export interface AssessmentReport {
  score: number; correct: number; total: number; subjects: AssessmentSubjectScore[];
}

/** The correct choice id for a bank row (mirrors buildStation for MC + true/false). */
function correctChoiceOf(type: string, p: Record<string, unknown>): string {
  if (type === 'true_false') {
    const yes = p.answer === true || p.answer === 'true' || p.correct_choice_id === 't';
    return yes ? 't' : 'f';
  }
  return String(p.correct_choice_id ?? '');
}

/** Sample a spread of graded questions across the grade's subjects for a test.
 *  Multiple-choice + true/false only; no hints/answers are exposed to the client. */
export async function getAssessmentQuestions(
  grade: string, count = 20, kind: 'mid' | 'end' = 'end',
): Promise<AssessmentQuestion[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { topics, qByTopic } = await fetchBank(sb, grade);
    // Topics per subject, ordered — for a mid-year test we only draw from the
    // first half of each subject's sequence (the material covered by then).
    const topicsBySubject = new Map<string, TopicRow[]>();
    for (const t of topics) {
      if (t.subject === LEADERSHIP_SUBJECT) continue;
      if ((qByTopic.get(t.id)?.length ?? 0) === 0) continue;
      const arr = topicsBySubject.get(t.subject) ?? [];
      arr.push(t);
      topicsBySubject.set(t.subject, arr);
    }
    const eligible = new Set<string>();
    for (const arr of topicsBySubject.values()) {
      arr.sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
      const keep = kind === 'mid' ? Math.max(1, Math.ceil(arr.length / 2)) : arr.length;
      arr.slice(0, keep).forEach((t) => eligible.add(t.id));
    }
    const bySubject = new Map<string, { subject: string; q: QRow }[]>();
    for (const t of topics) {
      if (!eligible.has(t.id)) continue;
      for (const q of qByTopic.get(t.id) ?? []) {
        if (q.type !== 'multiple_choice' && q.type !== 'true_false') continue;
        const arr = bySubject.get(t.subject) ?? [];
        arr.push({ subject: t.subject, q });
        bySubject.set(t.subject, arr);
      }
    }
    const subjects = [...bySubject.keys()];
    if (!subjects.length) return [];
    for (const arr of bySubject.values()) shuffle(arr);
    // Round-robin across subjects for a balanced spread.
    const picked: { subject: string; q: QRow }[] = [];
    let added = true;
    while (picked.length < count && added) {
      added = false;
      for (const s of subjects) {
        const arr = bySubject.get(s)!;
        if (arr.length) { picked.push(arr.pop()!); added = true; if (picked.length >= count) break; }
      }
    }
    return picked.map(({ subject, q }) => {
      const p = q.payload;
      const choices = q.type === 'true_false'
        ? [{ id: 't', text: 'נכון' }, { id: 'f', text: 'לא נכון' }]
        : shuffle(((p.choices as { id: string; text: string }[]) ?? []).map((c) => ({ id: c.id, text: c.text })));
      return {
        id: q.id, subject, subjectLabel: SUBJECT_LABEL[subject] ?? subject,
        tag: String(p.tag ?? ''), stem: String(p.stem ?? ''), choices,
      };
    });
  } catch {
    return null;
  }
}

/** Grade a submitted assessment server-side (never trust the client) and save it. */
export async function gradeAndSaveAssessment(
  childId: string, grade: string, answers: { questionId: string; choiceId: string }[],
  kind: 'mid' | 'end' = 'end',
): Promise<AssessmentReport | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const ids = answers.map((a) => a.questionId);
    if (!ids.length) return null;
    const { data: rows } = await sb.from('questions_bank').select('id,type,topic_id,payload').in('id', ids);
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
    const topicIds = [...new Set((rows ?? []).map((r) => r.topic_id as string))];
    const { data: tps } = await sb.from('curriculum_topics').select('id,subject').in('id', topicIds);
    const subjOf = new Map((tps ?? []).map((t) => [t.id as string, t.subject as string]));

    const tally = new Map<string, { correct: number; total: number }>();
    let correct = 0;
    for (const a of answers) {
      const row = byId.get(a.questionId);
      if (!row) continue;
      const subject = subjOf.get(row.topic_id as string) ?? 'other';
      const e = tally.get(subject) ?? { correct: 0, total: 0 };
      e.total += 1;
      if (a.choiceId === correctChoiceOf(String(row.type), row.payload as Record<string, unknown>)) {
        e.correct += 1; correct += 1;
      }
      tally.set(subject, e);
    }
    const total = answers.length;
    const subjects: AssessmentSubjectScore[] = [...tally.entries()]
      .map(([subject, e]) => ({ subject, label: SUBJECT_LABEL[subject] ?? subject, correct: e.correct, total: e.total }))
      .sort((a, b) => b.total - a.total);
    const score = total ? Math.round((correct / total) * 100) : 0;

    // Best-effort save (needs the assessments table). Include kind if the column
    // exists; fall back without it so an un-migrated DB still records the result.
    try {
      const { error } = await sb.from('assessments').insert({ child_id: childId, grade, kind, score, correct, total, subjects });
      if (error) await sb.from('assessments').insert({ child_id: childId, grade, score, correct, total, subjects });
    } catch { /* table may not exist yet */ }

    return { score, correct, total, subjects };
  } catch {
    return null;
  }
}

export interface AssessmentRecord { id: string; grade: string; kind: 'mid' | 'end'; score: number; correct: number; total: number; when: string; subjects: AssessmentSubjectScore[] }

/** Past assessments for a child (parent view). [] if the table isn't there yet. */
export async function getAssessments(childId: string, limit = 10): Promise<AssessmentRecord[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const withKind = await sb.from('assessments')
      .select('id,grade,kind,score,correct,total,subjects,created_at')
      .eq('child_id', childId).order('created_at', { ascending: false }).limit(limit);
    let rows = withKind.data as Record<string, unknown>[] | null;
    if (withKind.error) { // older DB without the kind column
      const noKind = await sb.from('assessments')
        .select('id,grade,score,correct,total,subjects,created_at')
        .eq('child_id', childId).order('created_at', { ascending: false }).limit(limit);
      if (noKind.error || !noKind.data) return [];
      rows = noKind.data as Record<string, unknown>[];
    }
    if (!rows) return [];
    return rows.map((r) => ({
      id: r.id as string, grade: r.grade as string,
      kind: ((r as { kind?: string }).kind === 'mid' ? 'mid' : 'end') as 'mid' | 'end',
      score: r.score as number, correct: r.correct as number, total: r.total as number,
      when: r.created_at as string,
      subjects: Array.isArray(r.subjects) ? (r.subjects as AssessmentSubjectScore[]) : [],
    }));
  } catch {
    return [];
  }
}

/** Subjects the child has practised today - for the home "completed" marks. */
export async function getTodaySubjects(childId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const since = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const { data } = await sb
      .from('attempts_log')
      .select('topic_id,created_at')
      .eq('user_id', childId)
      .gte('created_at', since);
    if (!data?.length) return [];
    const topicIds = [...new Set(data.map((r) => r.topic_id as string))];
    const { data: topics } = await sb
      .from('curriculum_topics')
      .select('id,subject')
      .in('id', topicIds);
    return [...new Set((topics ?? []).map((t) => t.subject as string))];
  } catch {
    return [];
  }
}

export interface SubjectCard {
  subject: string;
  label: string;
  kind: StationKind;
  accuracy: number;   // 0..1, correct answers / total answers (review success)
  answered: number;   // total answers given in this subject
  solved: number;     // distinct questions answered correctly
  total: number;      // questions available in the bank
}

/** The subject map: every subject with content, plus this child's mastery. */
export async function getSubjectCatalog(grade: string, childId: string): Promise<SubjectCard[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { topics, qByTopic } = await fetchBank(sb, grade);
    const bySubject = new Map<string, { topicIds: string[]; count: number }>();
    for (const t of topics) {
      const n = qByTopic.get(t.id)?.length ?? 0;
      if (!n) continue;
      const e = bySubject.get(t.subject) ?? { topicIds: [], count: 0 };
      e.topicIds.push(t.id);
      e.count += n;
      bySubject.set(t.subject, e);
    }
    if (!bySubject.size) return null;

    // Accuracy per subject from the attempts log (correct vs total answers).
    const topicToSubject = new Map(topics.map((t) => [t.id, t.subject]));
    const { data: attempts } = await sb
      .from('attempts_log')
      .select('topic_id,question_id,is_correct')
      .eq('user_id', childId);
    const tally = new Map<string, { answered: number; correct: number; solved: Set<string> }>();
    for (const a of attempts ?? []) {
      const subject = topicToSubject.get(a.topic_id as string);
      if (!subject) continue;
      const e = tally.get(subject) ?? { answered: 0, correct: 0, solved: new Set<string>() };
      e.answered += 1;
      if (a.is_correct) { e.correct += 1; e.solved.add(a.question_id as string); }
      tally.set(subject, e);
    }

    // Academic + enrichment subjects. Leadership worlds are surfaced separately.
    // Parent-locked (sensitive) subjects are hidden from the child's map.
    const locked = await getLockedSubjects(sb);
    const order = ['math', 'geometry', 'hebrew', 'bible', 'arabic', 'english', 'science', 'geography',
      'future_skills', 'economics', 'fashion', 'politics', 'ai', 'philosophy',
      'metacognition', 'geopolitics', 'cognitive_bias', 'epigenetics', 'procrastination',
      'decision_making', 'neuroplasticity', 'financial_literacy', 'gifted'];
    const cards: SubjectCard[] = [];
    for (const subject of order) {
      if (locked.has(subject)) continue;
      const e = bySubject.get(subject);
      if (!e) continue;
      const t = tally.get(subject);
      const answered = t?.answered ?? 0;
      const correct = t?.correct ?? 0;
      cards.push({
        subject, label: SUBJECT_LABEL[subject] ?? subject,
        kind: SUBJECT_KIND[subject] ?? 'core',
        accuracy: answered ? Number((correct / answered).toFixed(2)) : 0,
        answered, solved: t?.solved.size ?? 0, total: e.count,
      });
    }
    return cards;
  } catch {
    return null;
  }
}

/** Daily coin ceiling - anti-gaming, so extra quests can't farm unlimited coins. */
export const DAILY_COIN_CAP = 100;

/**
 * Persist a completed quest round. Idempotent for the day: streak advances only
 * on the first completion, and coins are capped so extra rounds hit diminishing
 * returns then stop earning. Returns the coins actually granted after the cap.
 */
export async function completeQuest(coinsEarned: number, childId?: string, xpEarned = 0): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  try {
    const child = childId ? await getChildProfileById(childId) : await getChildProfile();
    if (!child) return 0;
    const today = new Date().toISOString().slice(0, 10);

    const { data: row } = await sb
      .from('daily_progress')
      .select('quest_completed,coins_awarded_today')
      .eq('user_id', child.id).eq('date', today)
      .maybeSingle();

    const alreadyAwarded = row?.coins_awarded_today ?? 0;
    const firstToday = !row?.quest_completed;
    // Diminishing returns: each extra round the same day is worth progressively
    // less (down to 30%), then the daily cap stops earning entirely.
    const factor = Math.max(0.3, 1 - alreadyAwarded / DAILY_COIN_CAP);
    const decayed = Math.round(coinsEarned * factor);
    const grant = Math.max(0, Math.min(decayed, DAILY_COIN_CAP - alreadyAwarded));

    await sb.from('users').update({
      quest_coins: child.coins + grant,
      current_streak: firstToday ? child.streak + 1 : child.streak,
      total_xp: child.xp + Math.max(0, xpEarned),
    }).eq('id', child.id);

    await sb.from('daily_progress').upsert({
      user_id: child.id, date: today, stations_completed: 4,
      quest_completed: true, coins_awarded_today: alreadyAwarded + grant,
    });
    return grant;
  } catch {
    return 0;
  }
}

/**
 * Log one answer and advance the child's mastery for that topic (SM-2).
 * This is what makes the Composer adaptive over time. Best-effort.
 */
export async function logAttempt(childId: string, a: AttemptInput): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const hints = a.hintsUsed ?? 0;
    await sb.from('attempts_log').insert({
      user_id: childId,
      question_id: a.questionId,
      topic_id: a.topicId,
      is_correct: a.isCorrect,
      chosen_answer: a.chosenAnswer ?? null,
      misconception_tag: a.misconception ?? null,
      hints_used: hints,
    });

    const { data: m } = await sb
      .from('user_mastery')
      .select('mastery_score,attempts_count,ease_factor,interval_days,misconception_tags')
      .eq('user_id', childId).eq('topic_id', a.topicId)
      .maybeSingle();

    const quality = qualityFrom(a.isCorrect, hints);
    const next = sm2(
      { ease: Number(m?.ease_factor ?? 2.5), interval: Number(m?.interval_days ?? 0) },
      quality,
    );
    const mastery = updateMastery(Number(m?.mastery_score ?? 0), a.isCorrect);

    // Track misconception tags on wrong answers (unique-ish, capped).
    const tags: string[] = Array.isArray(m?.misconception_tags) ? [...m!.misconception_tags] : [];
    if (!a.isCorrect && a.misconception && !tags.includes(a.misconception)) {
      tags.push(a.misconception);
    }

    await sb.from('user_mastery').upsert({
      user_id: childId,
      topic_id: a.topicId,
      mastery_score: mastery,
      attempts_count: Number(m?.attempts_count ?? 0) + 1,
      last_attempt: new Date().toISOString(),
      next_review_at: next.nextReviewAt,
      ease_factor: next.ease,
      interval_days: next.interval,
      misconception_tags: tags.slice(-8),
    });
    return true;
  } catch {
    return false;
  }
}

export interface Reward {
  id: string;
  title: string;
  category: string;
  cost: number;
}

/** Active family rewards, cheapest first. */
export async function getRewards(): Promise<Reward[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('reward_store')
      .select('id,title,category,cost_coins')
      .eq('is_active', true)
      .order('cost_coins', { ascending: true });
    if (!data) return null;
    return data.map((r) => ({ id: r.id, title: r.title, category: r.category, cost: r.cost_coins }));
  } catch {
    return null;
  }
}

/** The single family's id (from an existing reward or any user). */
async function getFamilyId(sb: NonNullable<ReturnType<typeof getSupabase>>): Promise<string | null> {
  try {
    const r = await sb.from('reward_store').select('family_id').limit(1).maybeSingle();
    if (r.data?.family_id) return r.data.family_id as string;
    const u = await sb.from('users').select('family_id').not('family_id', 'is', null).limit(1).maybeSingle();
    return (u.data?.family_id as string) ?? null;
  } catch {
    return null;
  }
}

/** Parent: add a reward to the family store. */
// reward_store.category is a fixed enum; 'privilege' is the safe generic default
// (the UI doesn't ask for a category, so an invalid value would silently fail).
export async function addReward(title: string, cost: number, category = 'privilege'): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const familyId = await getFamilyId(sb);
    if (!familyId) return false;
    const { error } = await sb.from('reward_store').insert({
      family_id: familyId, title, category, cost_coins: Math.max(1, Math.round(cost)), is_active: true,
    });
    return !error;
  } catch { return false; }
}

/** Parent: change a reward's title and/or cost. */
export async function updateReward(id: string, patch: { title?: string; cost?: number }): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const update: Record<string, unknown> = {};
    if (patch.title != null) update.title = patch.title;
    if (patch.cost != null) update.cost_coins = Math.max(1, Math.round(patch.cost));
    if (!Object.keys(update).length) return true;
    const { error } = await sb.from('reward_store').update(update).eq('id', id);
    return !error;
  } catch { return false; }
}

/** Parent: retire a reward (soft delete). */
export async function removeReward(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from('reward_store').update({ is_active: false }).eq('id', id);
    return !error;
  } catch { return false; }
}

export interface RedeemResult {
  ok: boolean;
  reason?: string;
  voucher?: string;
  coins?: number;
}

/**
 * Redeem a reward: deduct coins and send a request to the parent (status
 * 'issued' = pending). The parent marks it done or refunds it. Coins are the
 * only limit - a child may redeem again as long as they can afford it.
 */
export async function redeemReward(childId: string, rewardId: string): Promise<RedeemResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'no-db' };
  try {
    const child = await getChildProfileById(childId);
    if (!child) return { ok: false, reason: 'no-child' };
    const { data: reward } = await sb
      .from('reward_store')
      .select('id,cost_coins,title')
      .eq('id', rewardId)
      .maybeSingle();
    if (!reward) return { ok: false, reason: 'no-reward' };
    if (child.coins < reward.cost_coins) return { ok: false, reason: 'not-enough' };

    const ref = 'QL-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const left = child.coins - reward.cost_coins;
    await sb.from('users').update({ quest_coins: left }).eq('id', child.id);
    await sb.from('reward_redemptions').insert({
      reward_id: reward.id, child_id: child.id,
      coins_spent: reward.cost_coins, voucher_code: ref, status: 'issued',
    });
    return { ok: true, coins: left };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export interface Redemption { id: string; childName: string; rewardTitle: string; cost: number; when: string }

/** Pending reward requests for the parent to fulfil (status 'issued'). */
export async function getPendingRedemptions(): Promise<Redemption[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('reward_redemptions')
      .select('id,child_id,reward_id,coins_spent,created_at')
      .eq('status', 'issued')
      .order('created_at', { ascending: true })
      .limit(50);
    if (!data?.length) return [];
    const childIds = [...new Set(data.map((r) => r.child_id as string))];
    const rewardIds = [...new Set(data.map((r) => r.reward_id as string))];
    const [{ data: kids }, { data: rewards }] = await Promise.all([
      sb.from('users').select('id,display_name').in('id', childIds),
      sb.from('reward_store').select('id,title').in('id', rewardIds),
    ]);
    const kmap = new Map((kids ?? []).map((k) => [k.id as string, k.display_name as string]));
    const rmap = new Map((rewards ?? []).map((r) => [r.id as string, r.title as string]));
    return data.map((r) => ({
      id: r.id as string,
      childName: kmap.get(r.child_id as string) ?? '-',
      rewardTitle: rmap.get(r.reward_id as string) ?? '-',
      cost: r.coins_spent as number,
      when: r.created_at as string,
    }));
  } catch {
    return null;
  }
}

/** Parent decision on a reward request: fulfil (mark done) or refund the coins. */
export async function resolveRedemption(id: string, action: 'fulfill' | 'refund'): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    if (action === 'fulfill') {
      const { error } = await sb.from('reward_redemptions').update({ status: 'acknowledged' }).eq('id', id);
      return !error;
    }
    // Refund: give the coins back to the child, then remove the request.
    const { data: r } = await sb
      .from('reward_redemptions').select('child_id,coins_spent,status').eq('id', id).maybeSingle();
    if (!r || r.status !== 'issued') return false;
    const child = await getChildProfileById(r.child_id as string);
    if (child) await sb.from('users').update({ quest_coins: child.coins + (r.coins_spent as number) }).eq('id', child.id);
    const { error } = await sb.from('reward_redemptions').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export interface CompassOption { id: string; label: string; icon: string }
export interface CompassWorld {
  topicId: string;
  questionId: string;
  order: number;
  name: string;
  kind: 'reflection' | 'budget' | 'scenario';
  prompt: string;
  note: string;
  options: CompassOption[];
  coins?: number;      // budget worlds: how many time-coins to allocate
  deposits: number;    // how many times the child has engaged this world
}

/** The 4 leadership worlds of "אי המצפן", with this child's deposit counts. */
export async function getCompassWorlds(childId: string): Promise<CompassWorld[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: topics } = await sb
      .from('curriculum_topics')
      .select('id,sub_topic,order_index')
      .eq('subject', LEADERSHIP_SUBJECT)
      .order('order_index', { ascending: true });
    if (!topics?.length) return null;
    const ids = topics.map((t) => t.id);

    const { data: qs } = await sb
      .from('questions_bank')
      .select('id,topic_id,payload')
      .in('topic_id', ids);
    const qByTopic = new Map<string, { id: string; payload: Record<string, unknown> }>();
    for (const q of qs ?? []) {
      if (!qByTopic.has(q.topic_id as string)) {
        qByTopic.set(q.topic_id as string, { id: q.id as string, payload: q.payload as Record<string, unknown> });
      }
    }

    const { data: att } = await sb
      .from('attempts_log').select('topic_id').eq('user_id', childId).in('topic_id', ids);
    const counts = new Map<string, number>();
    for (const a of att ?? []) counts.set(a.topic_id as string, (counts.get(a.topic_id as string) ?? 0) + 1);

    const worlds: CompassWorld[] = [];
    for (const t of topics) {
      const q = qByTopic.get(t.id);
      if (!q) continue;
      const p = q.payload;
      const raw = (p.options ?? p.choices ?? []) as { id: string; label: string; icon: string }[];
      worlds.push({
        topicId: t.id, questionId: q.id, order: Number(t.order_index ?? 0),
        name: t.sub_topic,
        kind: (p.kind as CompassWorld['kind']) ?? 'scenario',
        prompt: String(p.prompt ?? ''), note: String(p.note ?? ''),
        options: raw.map((o) => ({ id: o.id, label: o.label, icon: o.icon })),
        coins: typeof p.coins === 'number' ? (p.coins as number) : undefined,
        deposits: counts.get(t.id) ?? 0,
      });
    }
    return worlds;
  } catch {
    return null;
  }
}

/**
 * Record one leadership "deposit" (stamp / choice / allocation). Not scored on
 * accuracy, but it counts as part of the day and grants a small fixed reward -
 * XP always, plus a few coins the first time each world is engaged that day.
 */
export async function recordDeposit(childId: string, topicId: string, questionId: string, choice: unknown): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const dayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const { data: earlier } = await sb
      .from('attempts_log').select('id')
      .eq('user_id', childId).eq('topic_id', topicId)
      .gte('created_at', dayStart).limit(1);
    const firstToday = !earlier?.length;

    await sb.from('attempts_log').insert({
      user_id: childId, question_id: questionId, topic_id: topicId,
      is_correct: true, chosen_answer: choice ?? null, hints_used: 0,
    });
    await addXp(childId, 5); // identity XP for a leadership deposit

    if (firstToday) {
      const child = await getChildProfileById(childId);
      if (child) await sb.from('users').update({ quest_coins: child.coins + 5 }).eq('id', childId);
    }
    return true;
  } catch {
    return false;
  }
}

export interface StatusBadge { key: string; label: string; desc: string; earned: boolean }
export interface ChildStatus {
  name: string;
  xp: number; level: number; inLevel: number; need: number;
  coins: number; streak: number;
  subjects: SubjectCard[];
  strengths: SubjectCard[];
  toTrain: SubjectCard[];
  badges: StatusBadge[];
}

/** Everything the "המצב שלי" screen needs: level, strengths, weak spots, badges. */
export async function getChildStatus(childId: string, grade: string): Promise<ChildStatus | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const [child, catalog, worlds] = await Promise.all([
      getChildProfileById(childId),
      getSubjectCatalog(grade, childId),
      getCompassWorlds(childId),
    ]);
    if (!child) return null;
    const subjects = catalog ?? [];
    const lvl = levelFromXp(child.xp);

    const practiced = subjects.filter((s) => s.answered > 0);
    const strengths = [...practiced].sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
    // Weak spots: lowest accuracy among practiced, then unpracticed subjects.
    const weakPracticed = [...practiced].sort((a, b) => a.accuracy - b.accuracy);
    const untouched = subjects.filter((s) => s.answered === 0);
    const toTrain = [...weakPracticed.filter((s) => s.accuracy < 0.8), ...untouched].slice(0, 3);

    const totalAnswered = subjects.reduce((n, s) => n + s.answered, 0);
    const leadDeposits = (worlds ?? []).reduce((n, w) => n + w.deposits, 0);
    const heartDeposits = (worlds ?? []).find((w) => w.order === 4)?.deposits ?? 0;
    const timeDeposits = (worlds ?? []).find((w) => w.order === 2)?.deposits ?? 0;
    const sharp = subjects.some((s) => s.answered >= 5 && s.accuracy >= 0.9);

    const badges: StatusBadge[] = [
      { key: 'first_step', label: 'צעד ראשון', desc: 'התחלת לתרגל', earned: totalAnswered > 0 || leadDeposits > 0 || child.xp > 0 || child.streak > 0 },
      { key: 'streak_3', label: 'שלושה ברצף', desc: '3 ימים ברצף', earned: child.streak >= 3 },
      { key: 'streak_7', label: 'שבוע חזק', desc: '7 ימים ברצף', earned: child.streak >= 7 },
      { key: 'sharp', label: 'דיוק חד', desc: '90% דיוק בנושא', earned: sharp },
      { key: 'century', label: 'מאה שאלות', desc: '100 שאלות נענו', earned: totalAnswered >= 100 },
      { key: 'gold_heart', label: 'לב זהב', desc: '5 הפקדות לב', earned: heartDeposits >= 5 },
      { key: 'wise_time', label: 'בחירה חכמה', desc: '3 חלוקות זמן', earned: timeDeposits >= 3 },
    ];

    return {
      name: child.name,
      xp: child.xp, level: lvl.level, inLevel: lvl.inLevel, need: lvl.need,
      coins: child.coins, streak: child.streak,
      subjects, strengths, toTrain, badges,
    };
  } catch {
    return null;
  }
}

export interface TopicOverview { id: string; subject: string; subTopic: string; grade: string; count: number }

/** All curriculum topics with their question counts - the parent content panel. */
export async function getTopicsOverview(): Promise<TopicOverview[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: topics } = await sb
      .from('curriculum_topics')
      .select('id,subject,sub_topic,grade')
      .order('subject', { ascending: true })
      .order('grade', { ascending: true });
    if (!topics?.length) return null;
    const { data: qs } = await sb
      .from('questions_bank').select('topic_id').in('topic_id', topics.map((t) => t.id));
    const counts = new Map<string, number>();
    for (const q of qs ?? []) counts.set(q.topic_id as string, (counts.get(q.topic_id as string) ?? 0) + 1);
    return topics.map((t) => ({
      id: t.id as string, subject: t.subject as string,
      subTopic: t.sub_topic as string, grade: t.grade as string,
      count: counts.get(t.id as string) ?? 0,
    }));
  } catch {
    return null;
  }
}

// ─────────────────────────── Home tasks (chores) ───────────────────────────
export interface HomeTask {
  id: string; title: string; coins: number;
  pending: boolean;        // waiting for a parent → not tappable now
  approvedToday: boolean;  // done & approved today → can be done again (repeatable)
}

/** Active chores + today's state per chore: waiting for approval (locked), or
 *  already approved today (still repeatable - tidy the room again). */
export async function getHomeTasks(childId?: string): Promise<HomeTask[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: tasks, error } = await sb
      .from('home_tasks').select('id,title,coins')
      .eq('active', true)
      .order('coins', { ascending: false })   // most valuable chores first
      .order('created_at', { ascending: true });
    if (error || !tasks) return null;

    // The done-lookup is best-effort: if it fails, still show the tasks.
    const pendingSet = new Set<string>();
    const approvedSet = new Set<string>();
    if (childId) {
      const day = new Date().toISOString().slice(0, 10);
      // Prefer the status column (approval flow); fall back if it's not there yet.
      let rows = (await sb.from('home_task_done').select('task_id,status')
        .eq('child_id', childId).eq('day', day)).data as { task_id: string; status?: string }[] | null;
      if (!rows) {
        rows = (await sb.from('home_task_done').select('task_id')
          .eq('child_id', childId).eq('day', day)).data as { task_id: string }[] | null;
      }
      for (const r of rows ?? []) {
        const status = (r as { status?: string }).status;
        if (status === 'pending') pendingSet.add(r.task_id);
        else approvedSet.add(r.task_id); // 'approved', or no status column (old rows)
      }
    }
    return tasks.map((t) => ({
      id: t.id as string, title: t.title as string, coins: t.coins as number,
      pending: pendingSet.has(t.id as string),
      approvedToday: approvedSet.has(t.id as string),
    }));
  } catch {
    return null;
  }
}

/** Plain list of active chores (for the parent editor - no per-child state). */
export async function listHomeTasks(): Promise<{ id: string; title: string; coins: number }[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('home_tasks').select('id,title,coins')
      .eq('active', true).order('created_at', { ascending: true });
    return (data ?? []).map((t) => ({ id: t.id as string, title: t.title as string, coins: t.coins as number }));
  } catch {
    return null;
  }
}

export async function addHomeTask(title: string, coins: number): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from('home_tasks').insert({ title, coins });
    return !error;
  } catch { return false; }
}

export async function removeHomeTask(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from('home_tasks').update({ active: false }).eq('id', id);
    return !error;
  } catch { return false; }
}

/** Parent: change a chore's title and/or its coin value. */
export async function updateHomeTask(id: string, patch: { title?: string; coins?: number }): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const update: Record<string, unknown> = {};
    if (patch.title != null) update.title = patch.title;
    if (patch.coins != null) update.coins = Math.max(1, Math.round(patch.coins));
    if (!Object.keys(update).length) return true;
    const { error } = await sb.from('home_tasks').update(update).eq('id', id);
    return !error;
  } catch { return false; }
}

export interface TaskDoneResult { ok: boolean; reason?: string; coins?: number; earned?: number; pending?: boolean }

/**
 * Child checks off a chore. It goes to the parent as "pending" - the coins are
 * credited only when a parent approves (so the parent verifies it was really
 * done). Chores are repeatable: after a chore is approved the child can do it
 * again (the same day's row simply cycles back to 'pending').
 * Falls back to instant-credit if the status column isn't there yet.
 */
export async function completeHomeTask(childId: string, taskId: string): Promise<TaskDoneResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'no-db' };
  try {
    const child = await getChildProfileById(childId);
    if (!child) return { ok: false, reason: 'no-child' };
    const { data: task } = await sb
      .from('home_tasks').select('id,coins,active').eq('id', taskId).maybeSingle();
    if (!task || !task.active) return { ok: false, reason: 'no-task' };
    const earned = (task.coins as number) ?? 0;
    const day = new Date().toISOString().slice(0, 10);

    // Look at today's row (if any) with an explicit select - no reliance on a
    // specific unique-constraint name for upsert onConflict, which was flaky.
    const { data: existing } = await sb
      .from('home_task_done').select('id,status')
      .eq('task_id', taskId).eq('child_id', childId).eq('day', day).maybeSingle();

    if (existing) {
      if ((existing as { status?: string }).status === 'pending') {
        return { ok: false, reason: 'already' }; // already waiting for a parent
      }
      // Approved earlier today → she's doing it again: cycle back to pending.
      const { error } = await sb
        .from('home_task_done').update({ status: 'pending' }).eq('id', (existing as { id: string }).id);
      if (!error) return { ok: true, pending: true, earned };
      return { ok: false, reason: 'already' }; // couldn't update → treat as done
    }

    // No row today → create a pending one (parent must approve before coins).
    const { error: insErr } = await sb
      .from('home_task_done').insert({ task_id: taskId, child_id: childId, day, status: 'pending' });
    if (!insErr) return { ok: true, pending: true, earned };

    // The status column isn't there yet (pre-migration) → old behavior: insert
    // plainly and credit immediately.
    const { error: insErr2 } = await sb
      .from('home_task_done').insert({ task_id: taskId, child_id: childId, day });
    if (insErr2) return { ok: false, reason: 'already' };
    const coins = child.coins + earned;
    await sb.from('users').update({ quest_coins: coins }).eq('id', childId);
    return { ok: true, coins, earned };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export interface TaskApproval {
  id: string; childId: string; childName: string; taskTitle: string; coins: number; day: string;
}

/** Chores kids marked done that are waiting for a parent to approve. */
export async function getPendingTaskApprovals(): Promise<TaskApproval[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('home_task_done').select('id,task_id,child_id,day,status')
      .eq('status', 'pending').order('day', { ascending: false }).limit(50);
    if (error) return []; // status column not there yet → nothing pending
    if (!data?.length) return [];
    const taskIds = [...new Set(data.map((r) => r.task_id as string))];
    const childIds = [...new Set(data.map((r) => r.child_id as string))];
    const [{ data: tasks }, { data: kids }] = await Promise.all([
      sb.from('home_tasks').select('id,title,coins').in('id', taskIds),
      sb.from('users').select('id,display_name').in('id', childIds),
    ]);
    const tmap = new Map((tasks ?? []).map((t) => [t.id as string, t]));
    const kmap = new Map((kids ?? []).map((k) => [k.id as string, k.display_name as string]));
    return data.map((r) => {
      const t = tmap.get(r.task_id as string) as { title?: string; coins?: number } | undefined;
      return {
        id: r.id as string, childId: r.child_id as string,
        childName: kmap.get(r.child_id as string) ?? 'ילדה',
        taskTitle: t?.title ?? 'מטלה', coins: t?.coins ?? 0, day: r.day as string,
      };
    });
  } catch {
    return null;
  }
}

/** Parent decision on a pending chore: 'approve' credits the coins; 'reject'
 *  removes it (the child can do it again). */
export async function resolveTaskApproval(id: string, action: 'approve' | 'reject'): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { data: row } = await sb
      .from('home_task_done').select('id,task_id,child_id,status').eq('id', id).maybeSingle();
    if (!row) return false;
    if (action === 'reject') {
      await sb.from('home_task_done').delete().eq('id', id);
      return true;
    }
    if (row.status !== 'pending') return true; // already handled
    const [{ data: task }, child] = await Promise.all([
      sb.from('home_tasks').select('coins').eq('id', row.task_id as string).maybeSingle(),
      getChildProfileById(row.child_id as string),
    ]);
    const earned = (task?.coins as number) ?? 0;
    if (child) await sb.from('users').update({ quest_coins: child.coins + earned }).eq('id', row.child_id as string);
    await sb.from('home_task_done').update({ status: 'approved' }).eq('id', id);
    return true;
  } catch {
    return false;
  }
}

// ─────────────── Parent: flagged-question review (content trust layer) ───────────────
export interface FlaggedQuestion {
  id: string; subject: string; subTopic: string; grade: string;
  stem: string; reason: string; correctText: string; correctId: string; choices: { id: string; text: string }[];
}

/** Questions the verifier held back (verification_status='auto_flagged') for a parent to review. */
export async function getFlaggedQuestions(): Promise<FlaggedQuestion[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('questions_bank')
      .select('id,topic_id,payload')
      .eq('verification_status', 'auto_flagged')
      .limit(50);
    if (!data?.length) return [];
    const topicIds = [...new Set(data.map((r) => r.topic_id as string))];
    const { data: topics } = await sb
      .from('curriculum_topics').select('id,subject,sub_topic,grade').in('id', topicIds);
    const tmap = new Map((topics ?? []).map((t) => [t.id as string, t]));
    return data.map((r) => {
      const p = (r.payload ?? {}) as { stem?: string; flag_reason?: string; correct_choice_id?: string; choices?: { id: string; text: string }[] };
      const t = tmap.get(r.topic_id as string) as { subject?: string; sub_topic?: string; grade?: string } | undefined;
      const choices = (p.choices ?? []).map((c) => ({ id: c.id, text: String(c.text) }));
      const correct = choices.find((c) => c.id === p.correct_choice_id);
      return {
        id: r.id as string,
        subject: t?.subject ?? '', subTopic: t?.sub_topic ?? '', grade: t?.grade ?? '',
        stem: String(p.stem ?? ''), reason: String(p.flag_reason ?? 'סומן לבדיקה'),
        correctText: correct?.text ?? '', correctId: String(p.correct_choice_id ?? ''), choices,
      };
    });
  } catch {
    return null;
  }
}

/** Questions a parent already approved (verification_status='parent_approved') -
 *  so a parent can review and delete ones approved by mistake. */
export async function getApprovedQuestions(): Promise<FlaggedQuestion[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('questions_bank')
      .select('id,topic_id,payload')
      .eq('verification_status', 'parent_approved')
      .limit(100);
    if (!data?.length) return [];
    const topicIds = [...new Set(data.map((r) => r.topic_id as string))];
    const { data: topics } = await sb
      .from('curriculum_topics').select('id,subject,sub_topic,grade').in('id', topicIds);
    const tmap = new Map((topics ?? []).map((t) => [t.id as string, t]));
    return data.map((r) => {
      const p = (r.payload ?? {}) as { stem?: string; correct_choice_id?: string; choices?: { id: string; text: string }[] };
      const t = tmap.get(r.topic_id as string) as { subject?: string; sub_topic?: string; grade?: string } | undefined;
      const choices = (p.choices ?? []).map((c) => ({ id: c.id, text: String(c.text) }));
      const correct = choices.find((c) => c.id === p.correct_choice_id);
      return {
        id: r.id as string,
        subject: t?.subject ?? '', subTopic: t?.sub_topic ?? '', grade: t?.grade ?? '',
        stem: String(p.stem ?? ''), reason: '',
        correctText: correct?.text ?? '', correctId: String(p.correct_choice_id ?? ''), choices,
      };
    });
  } catch {
    return null;
  }
}

/** Parent decision on a question: approve → kids see it; reject → deleted;
 *  unapprove → sent back to the review queue (hidden from kids again). */
export async function reviewQuestion(id: string, action: 'approve' | 'reject' | 'unapprove'): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    if (action === 'approve') {
      const { error } = await sb.from('questions_bank').update({ verification_status: 'parent_approved' }).eq('id', id);
      return !error;
    }
    if (action === 'unapprove') {
      const { error } = await sb.from('questions_bank').update({ verification_status: 'auto_flagged' }).eq('id', id);
      return !error;
    }
    const { error } = await sb.from('questions_bank').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Award any newly-earned badges (persist in `badges`) and return the fresh ones
 * so the child can be congratulated in the moment - not only in "המצב שלי".
 */
export async function awardNewBadges(childId: string, grade: string): Promise<StatusBadge[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const status = await getChildStatus(childId, grade);
    if (!status) return [];
    const earned = status.badges.filter((b) => b.earned);
    if (!earned.length) return [];
    const { data: have } = await sb.from('badges').select('badge_key').eq('user_id', childId);
    const haveSet = new Set((have ?? []).map((r) => r.badge_key as string));
    const fresh = earned.filter((b) => !haveSet.has(b.key));
    if (fresh.length) {
      await sb.from('badges').insert(fresh.map((b) => ({ user_id: childId, badge_key: b.key })));
    }
    return fresh;
  } catch {
    return [];
  }
}

// ─────────────── Parent: sensitive-subject locks ───────────────
/** Subjects currently locked (hidden from kids). Defensive: if the parent_locked
 *  column doesn't exist yet, sensitive subjects default to locked. */
async function getLockedSubjects(sb: NonNullable<ReturnType<typeof getSupabase>>): Promise<Set<string>> {
  try {
    const { data, error } = await sb.from('curriculum_topics').select('subject,parent_locked');
    if (error) return new Set(SENSITIVE_SUBJECTS);
    const locked = new Set<string>();
    for (const r of data ?? []) if (r.parent_locked) locked.add(r.subject as string);
    return locked;
  } catch {
    return new Set(SENSITIVE_SUBJECTS);
  }
}

export interface LockRow { subject: string; label: string; locked: boolean }

/** Sensitive enrichment subjects with their current lock state (for the parent). */
export async function getSensitiveLocks(): Promise<LockRow[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const locked = await getLockedSubjects(sb);
    // Only show sensitive subjects that actually have content.
    const { data } = await sb.from('curriculum_topics').select('subject').in('subject', [...SENSITIVE_SUBJECTS]);
    const present = new Set((data ?? []).map((r) => r.subject as string));
    return [...SENSITIVE_SUBJECTS].filter((s) => present.has(s)).map((s) => ({
      subject: s, label: SUBJECT_LABEL[s] ?? s, locked: locked.has(s),
    }));
  } catch {
    return null;
  }
}

/** Lock or unlock a whole subject for the kids (updates every topic of that subject). */
export async function setSubjectLock(subject: string, locked: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from('curriculum_topics').update({ parent_locked: locked }).eq('subject', subject);
    return !error;
  } catch {
    return false;
  }
}

// ─────────────── Seasonal content (holiday / season by the calendar) ───────────────
interface Season { key: string; topicId: string; from: [number, number]; to: [number, number]; label: string; emoji: string }

// Approximate Gregorian windows (Hebrew holidays drift year to year; good enough
// for surfacing a seasonal highlight). Each maps to a seeded seasonal topic.
const SEASONS: Season[] = [
  { key: 'rosh',    topicId: 'b0000001-0000-4000-8000-000000000001', from: [8, 25],  to: [9, 20],  label: 'ראש השנה', emoji: '🍎' },
  { key: 'sukkot',  topicId: 'b0000001-0000-4000-8000-000000000002', from: [9, 21],  to: [10, 12], label: 'סוכות',    emoji: '🌿' },
  { key: 'hanukkah',topicId: 'b0000001-0000-4000-8000-000000000003', from: [12, 8],  to: [12, 31], label: 'חנוכה',    emoji: '🕎' },
  { key: 'tubshvat',topicId: 'b0000001-0000-4000-8000-000000000004', from: [1, 18],  to: [2, 12],  label: 'ט״ו בשבט', emoji: '🌳' },
  { key: 'purim',   topicId: 'b0000001-0000-4000-8000-000000000005', from: [2, 25],  to: [3, 22],  label: 'פורים',    emoji: '🎭' },
  { key: 'pesach',  topicId: 'b0000001-0000-4000-8000-000000000006', from: [3, 25],  to: [4, 20],  label: 'פסח',      emoji: '🍷' },
  { key: 'indep',   topicId: 'b0000001-0000-4000-8000-000000000007', from: [4, 21],  to: [5, 12],  label: 'יום העצמאות', emoji: '🇮🇱' },
  { key: 'shavuot', topicId: 'b0000001-0000-4000-8000-000000000008', from: [5, 15],  to: [6, 8],   label: 'שבועות',   emoji: '🌾' },
  { key: 'summer',  topicId: 'b0000001-0000-4000-8000-000000000009', from: [6, 20],  to: [8, 24],  label: 'קיץ',      emoji: '☀️' },
];

function activeSeason(now = new Date()): Season | null {
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  for (const s of SEASONS) {
    const lo = s.from[0] * 100 + s.from[1];
    const hi = s.to[0] * 100 + s.to[1];
    if (lo <= hi ? md >= lo && md <= hi : md >= lo || md <= hi) return s;
  }
  return null;
}

export interface SeasonalHighlight { topicId: string; label: string; emoji: string }

/** Today's seasonal topic, if one is active and actually has playable content. */
export async function getSeasonalHighlight(): Promise<SeasonalHighlight | null> {
  const s = activeSeason();
  if (!s) return null;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('questions_bank').select('id')
      .eq('topic_id', s.topicId).neq('verification_status', 'auto_flagged').limit(1);
    if (!data?.length) return null;
    return { topicId: s.topicId, label: s.label, emoji: s.emoji };
  } catch {
    return null;
  }
}
