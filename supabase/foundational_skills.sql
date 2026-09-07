-- Foundational grade-3 skills the parent asked for: reading a clock, and
-- right/left + spatial directions. Added as practice sub-topics so the generator
-- creates questions (nikud'd, grade-3 simple, validated against the curriculum
-- ground-truth). Run once; safe to re-run.
insert into curriculum_topics (id, grade, subject, sub_topic, order_index) values
  ('99999999-9999-9999-9999-000000000001', 'grade_3', 'math',     'קריאת השעון', 8),
  ('99999999-9999-9999-9999-000000000002', 'grade_3', 'geometry', 'ימין, שמאל וכיוונים', 8)
on conflict (id) do update set sub_topic = excluded.sub_topic, order_index = excluded.order_index;
