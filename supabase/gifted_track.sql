-- Gifted (מחוננים) reasoning track - original items in the style of Israeli
-- gifted-screening prep: verbal analogies, number series, odd-one-out, logic.
-- Topic names only; the generator fills questions on demand in kid-friendly
-- Hebrew, validated for a single unambiguous answer (see lib/curriculum.ts
-- giftedGuidance). Per grade so age-appropriate ranges apply. Run once; safe to
-- re-run. Requires enrichment_advanced.sql first (it drops the subject CHECK).

alter table curriculum_topics drop constraint if exists curriculum_topics_subject_check;

insert into curriculum_topics (id, grade, subject, sub_topic, order_index) values
  -- grade 3
  ('77777777-7777-7777-7777-000000000001', 'grade_3', 'gifted', 'אנלוגיות מילוליות', 1),
  ('77777777-7777-7777-7777-000000000002', 'grade_3', 'gifted', 'סדרות מספרים', 2),
  ('77777777-7777-7777-7777-000000000003', 'grade_3', 'gifted', 'היוצא דופן', 3),
  ('77777777-7777-7777-7777-000000000004', 'grade_3', 'gifted', 'חשיבה לוגית', 4),
  -- grade 5
  ('77777777-7777-7777-7777-000000000005', 'grade_5', 'gifted', 'אנלוגיות מילוליות', 1),
  ('77777777-7777-7777-7777-000000000006', 'grade_5', 'gifted', 'סדרות מספרים', 2),
  ('77777777-7777-7777-7777-000000000007', 'grade_5', 'gifted', 'היוצא דופן', 3),
  ('77777777-7777-7777-7777-000000000008', 'grade_5', 'gifted', 'חשיבה לוגית', 4)
on conflict (id) do update set sub_topic = excluded.sub_topic, order_index = excluded.order_index;
