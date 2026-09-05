// QuestLearn shared domain types (mirrors supabase/migrations/0001_init.sql)

export type Role = 'parent' | 'child';
export type Grade = 'grade_3' | 'grade_5';
export type TopicGrade = Grade | 'enrichment';

export type Subject =
  | 'math' | 'geometry' | 'hebrew' | 'english' | 'arabic'
  | 'geography' | 'bible' | 'science' | 'future_skills' | 'gifted' | 'leadership';

export type QuestionType =
  | 'multiple_choice' | 'match_pairs' | 'audio_listen_record' | 'drag_order'
  | 'open_ai_critique' | 'reflection_log' | 'choice_scenario' | 'budget_allocation';

export type VerificationStatus = 'pending' | 'auto_passed' | 'auto_flagged';

export type AvatarSlot = 'base' | 'skin_tone' | 'hairstyle' | 'hair_color' | 'top' | 'accessory';

export interface AvatarConfig {
  base: 'girl' | 'boy';
  skin_tone: string;     // hex
  hairstyle_id: string;
  hair_color: string;    // hex
  top_id: string;
  top_color: string;     // hex
  accessory_id: string | null;
}

export interface User {
  id: string;
  role: Role;
  parent_id: string | null;
  family_id: string;
  grade_level: Grade | null;
  display_name: string;
  avatar_config: AvatarConfig;
  interests: string[];
  current_streak: number;
  streak_freezes: number;
  total_xp: number;
  quest_coins: number;
  daily_goal_minutes: number;
  notify_enabled: boolean;
  created_at: string;
}

export interface CurriculumTopic {
  id: string;
  grade: TopicGrade;
  subject: Subject;
  sub_topic: string;
  order_index: number;
  prerequisites: string[];
  arabic_variant: 'spoken' | 'msa' | null;
  is_sensitive: boolean;
}

export interface Question {
  id: string;
  topic_id: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  payload: QuestionPayload;
  source: 'curated' | 'ai_generated';
  verification_status: VerificationStatus;
}

export interface QuestionPayload {
  stem: string;
  choices?: { id: string; text: string; misconception?: string }[];
  correct_choice_id?: string;
  hint?: string;
  explanation?: string;
}

export type StationKind = 'core' | 'lang' | 'future' | 'lead';

// A composed daily station for the home screen
export interface DailyStation {
  kind: StationKind;
  subject: Subject;
  title: string;
  subtitle: string;
  minutes: number;
  status: 'active' | 'upcoming' | 'locked' | 'done';
  order?: number;    // leadership world order
  topicId?: string;  // leadership world topic - deep-links the daily world inline
}
