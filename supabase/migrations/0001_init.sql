-- QuestLearn — initial schema (spec v5.2)
-- Postgres / Supabase. Enums modeled as TEXT + CHECK for portability.

create extension if not exists "pgcrypto";

-- ─────────────────────────── Users & auth ───────────────────────────
create table users (
  id                uuid primary key default gen_random_uuid(),
  role              text not null check (role in ('parent','child')),
  parent_id         uuid references users(id) on delete cascade,
  family_id         uuid not null,
  grade_level       text check (grade_level in ('grade_3','grade_5')),
  display_name      text not null,
  login_pin_hash    text,                    -- children only; parents use auth_accounts
  avatar_config     jsonb not null default '{}'::jsonb,  -- {base, skin_tone, hairstyle_id, hair_color, top_id, accessory_id}
  interests         text[] not null default '{}',
  current_streak    integer not null default 0,
  streak_freezes    integer not null default 0,
  total_xp          integer not null default 0,
  quest_coins       integer not null default 0,
  daily_goal_minutes integer not null default 8,
  notify_enabled    boolean not null default false,
  notify_device_token text,
  created_at        timestamptz not null default now()
);
create index users_parent_idx on users(parent_id);
create index users_family_idx on users(family_id);

create table auth_accounts (
  user_id       uuid primary key references users(id) on delete cascade,
  email         text not null unique,
  password_hash text not null,
  mfa           boolean not null default false
);

-- ─────────────────────────── Curriculum & content ───────────────────
create table curriculum_topics (
  id            uuid primary key default gen_random_uuid(),
  grade         text not null check (grade in ('grade_3','grade_5','enrichment')),
  subject       text not null check (subject in
                  ('math','geometry','hebrew','english','arabic','geography',
                   'bible','science','future_skills','leadership')),
  sub_topic     text not null,
  order_index   integer not null default 0,
  prerequisites uuid[] not null default '{}',
  arabic_variant text check (arabic_variant in ('spoken','msa')),
  is_sensitive  boolean not null default false   -- open by default; parent may lock
);

create table questions_bank (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid not null references curriculum_topics(id) on delete cascade,
  type          text not null check (type in
                  ('multiple_choice','match_pairs','audio_listen_record','drag_order',
                   'open_ai_critique','reflection_log','choice_scenario','budget_allocation')),
  difficulty    integer not null default 1 check (difficulty between 1 and 5),
  payload       jsonb not null,               -- question, answers, media, hint, misconception map
  source        text not null default 'ai_generated' check (source in ('curated','ai_generated')),
  verification_status text not null default 'pending'
                  check (verification_status in ('pending','auto_passed','auto_flagged')),
  verification_notes jsonb,
  created_at    timestamptz not null default now()
);
create index questions_topic_idx on questions_bank(topic_id);

-- ─────────────────────────── Learning state ─────────────────────────
create table user_mastery (
  user_id          uuid not null references users(id) on delete cascade,
  topic_id         uuid not null references curriculum_topics(id) on delete cascade,
  mastery_score    numeric(3,2) not null default 0 check (mastery_score between 0 and 1),
  attempts_count   integer not null default 0,
  last_attempt     timestamptz,
  next_review_at   timestamptz,             -- spaced repetition (SM-2)
  ease_factor      numeric(3,2) not null default 2.5,
  interval_days    integer not null default 0,
  misconception_tags text[] not null default '{}',
  primary key (user_id, topic_id)
);

create table attempts_log (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  -- Keep the attempt (topic_id + is_correct drive accuracy) when the question it
  -- referred to is deleted by a reset/purge - do NOT cascade the history away.
  question_id      uuid references questions_bank(id) on delete set null,
  topic_id         uuid not null references curriculum_topics(id) on delete cascade,
  is_correct       boolean not null,
  chosen_answer    jsonb,
  misconception_tag text,
  hints_used       integer not null default 0,
  response_time_ms integer,
  created_at       timestamptz not null default now()
);
create index attempts_user_idx on attempts_log(user_id, created_at);

create table parent_directives (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references users(id) on delete cascade,
  parent_id      uuid not null references users(id) on delete cascade,
  type           text not null check (type in ('pin','boost_interest','lock_topic','unlock_topic','inject_topic')),
  target_topic_id uuid references curriculum_topics(id) on delete cascade,
  target_subject text,
  weight_modifier numeric not null default 1,
  valid_until    timestamptz,
  created_at     timestamptz not null default now()
);

create table daily_progress (
  user_id            uuid not null references users(id) on delete cascade,
  date               date not null,
  stations_completed integer not null default 0 check (stations_completed between 0 and 4),
  quest_completed    boolean not null default false,
  coins_awarded_today integer not null default 0,   -- enforces the daily coin cap
  primary key (user_id, date)
);

-- ─────────────────────────── Rewards & economy ──────────────────────
create table reward_store (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  title       text not null,
  category    text not null check (category in
                ('screen_time','experience','privilege','physical_item','family_activity')),
  cost_coins  integer not null,
  is_active   boolean not null default true
);

create table reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  reward_id    uuid not null references reward_store(id) on delete cascade,
  child_id     uuid not null references users(id) on delete cascade,
  coins_spent  integer not null,
  voucher_code text not null,
  status       text not null default 'issued' check (status in ('issued','acknowledged')),
  created_at   timestamptz not null default now()
);

create table badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  badge_key  text not null,
  earned_at  timestamptz not null default now(),
  unique (user_id, badge_key)
);

create table family_goals (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  title        text not null,
  target       integer not null,
  progress     integer not null default 0,
  reward_coins integer not null default 0,
  week_of      date not null
);

-- ─────────────────────────── Avatar system (v5.2) ───────────────────
create table avatar_items (
  id             uuid primary key default gen_random_uuid(),
  slot           text not null check (slot in ('base','skin_tone','hairstyle','hair_color','top','accessory')),
  name           text not null,
  svg_layer      jsonb not null,             -- layer definition for the renderer
  unlock_type    text not null default 'default' check (unlock_type in ('default','coins','badge')),
  cost_coins     integer,
  required_badge_key text
);

create table user_avatar_items (
  user_id     uuid not null references users(id) on delete cascade,
  item_id     uuid not null references avatar_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ─────────────────────────── Privacy: audio ─────────────────────────
create table audio_recordings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  question_id  uuid references questions_bank(id) on delete set null,
  transcript   text,
  score        numeric(3,2),
  delete_after timestamptz not null          -- auto-purge after analysis
);
