-- History (היסטוריה), age-adapted. Grade 3 is "מולדת" style (past vs present,
-- symbols, holidays); grade 5 introduces early periods and the founding of
-- Israel, all in kid-friendly language. Topic names only; the generator fills
-- questions on demand, validated against lib/curriculum.ts history ground-truth.
-- Run once; safe to re-run. Requires enrichment_advanced.sql first (subject CHECK).

alter table curriculum_topics drop constraint if exists curriculum_topics_subject_check;

insert into curriculum_topics (id, grade, subject, sub_topic, order_index) values
  -- grade 3 (מולדת / היסטוריה מותאמת)
  ('88888888-8888-8888-8888-000000000001', 'grade_3', 'history', 'פעם והיום', 1),
  ('88888888-8888-8888-8888-000000000002', 'grade_3', 'history', 'סמלי המדינה', 2),
  ('88888888-8888-8888-8888-000000000003', 'grade_3', 'history', 'חגי ישראל וסיפורם', 3),
  ('88888888-8888-8888-8888-000000000004', 'grade_3', 'history', 'ציר הזמן שלי', 4),
  -- grade 5
  ('88888888-8888-8888-8888-000000000005', 'grade_5', 'history', 'תקופות קדומות', 1),
  ('88888888-8888-8888-8888-000000000006', 'grade_5', 'history', 'מצרים העתיקה', 2),
  ('88888888-8888-8888-8888-000000000007', 'grade_5', 'history', 'ראשית הציונות והעליות', 3),
  ('88888888-8888-8888-8888-000000000008', 'grade_5', 'history', 'הקמת מדינת ישראל', 4)
on conflict (id) do update set sub_topic = excluded.sub_topic, order_index = excluded.order_index;
