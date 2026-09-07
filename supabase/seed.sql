-- QuestLearn - seed data (dev). Run after 0001_init.sql.
-- Idempotent-ish: clears the demo family first, then re-inserts.
-- Safe to re-run.

delete from users where family_id = '11111111-1111-1111-1111-111111111111';
delete from curriculum_topics where id in (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000004',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'cccccccc-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000002',
  'cccccccc-0000-0000-0000-000000000003',
  'cccccccc-0000-0000-0000-000000000004',
  'cccccccc-0000-0000-0000-000000000005',
  'dddddddd-0000-0000-0000-000000000001',
  'dddddddd-0000-0000-0000-000000000002',
  'dddddddd-0000-0000-0000-000000000003',
  'dddddddd-0000-0000-0000-000000000004',
  'dddddddd-0000-0000-0000-000000000005',
  'eeeeeeee-0000-0000-0000-000000000001',
  'eeeeeeee-0000-0000-0000-000000000002',
  'eeeeeeee-0000-0000-0000-000000000003',
  'ffffffff-0000-0000-0000-000000000001',
  'ffffffff-0000-0000-0000-000000000002',
  'ffffffff-0000-0000-0000-000000000003'
);
delete from reward_store where family_id = '11111111-1111-1111-1111-111111111111';

-- Family: parent + two children (Mili grade 3, Lia grade 5)
insert into users (id, role, family_id, display_name) values
  ('22222222-2222-2222-2222-222222222222', 'parent', '11111111-1111-1111-1111-111111111111', 'הורה');

insert into users (id, role, parent_id, family_id, grade_level, display_name, quest_coins, current_streak, total_xp, daily_goal_minutes, avatar_config) values
  ('33333333-3333-3333-3333-333333333333', 'child',
   '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'grade_3', 'מילי', 120, 6, 0, 15,
   '{"base":"girl","skin_tone":"#FCE0C8","hairstyle_id":"long","hair_color":"#7A4B2B","top_id":"varsity","top_color":"#FF2A85","accessory_id":"bow"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'child',
   '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'grade_5', 'ליה', 210, 9, 0, 30,
   '{"base":"girl","skin_tone":"#E8B98F","hairstyle_id":"long","hair_color":"#1F1B18","top_id":"varsity","top_color":"#38BDF8","accessory_id":null}'::jsonb);

-- Allow every subject the app defines (the original CHECK only listed the first
-- few, which rejected 'seasonal'/'economics'/… ). The app owns the subject list.
alter table curriculum_topics drop constraint if exists curriculum_topics_subject_check;
alter table curriculum_topics add column if not exists parent_locked boolean not null default false;
alter table home_task_done add column if not exists status text not null default 'pending';
alter table users add column if not exists interests jsonb not null default '[]'::jsonb;
alter table users add column if not exists parent_focus jsonb not null default '[]'::jsonb;
alter table questions_bank drop constraint if exists questions_bank_type_check;

-- Topics. future_skills + leadership are shared (grade = enrichment);
-- math + arabic are grade-specific so each girl gets her own level.
insert into curriculum_topics (id, grade, subject, sub_topic, order_index, arabic_variant) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'grade_3', 'math', 'לוח הכפל', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'grade_3', 'arabic', 'ברכות', 1, 'spoken'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'grade_5', 'math', 'שברים', 1, null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'grade_5', 'arabic', 'קריאה ספרותית', 1, 'msa'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'grade_3', 'future_skills', 'יזמות: המצאות', 1, null),
  ('eeeeeeee-0000-0000-0000-000000000001', 'enrichment', 'leadership', 'צעד קטן של היום', 1, null),
  ('eeeeeeee-0000-0000-0000-000000000002', 'enrichment', 'leadership', 'הזמן שלי', 2, null),
  ('eeeeeeee-0000-0000-0000-000000000003', 'enrichment', 'leadership', 'להגיד לא בכבוד', 3, null),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'enrichment', 'leadership', 'מעשה טוב', 4, null),
  ('cccccccc-0000-0000-0000-000000000001', 'grade_3', 'geometry', 'צורות', 1, null),
  ('cccccccc-0000-0000-0000-000000000002', 'grade_3', 'hebrew', 'אוצר מילים', 1, null),
  ('cccccccc-0000-0000-0000-000000000003', 'grade_5', 'geometry', 'שטח והיקף', 1, null),
  ('cccccccc-0000-0000-0000-000000000004', 'grade_5', 'hebrew', 'הבנה וטיעון', 1, null),
  ('cccccccc-0000-0000-0000-000000000005', 'grade_3', 'science', 'עולם החי', 1, null),
  ('dddddddd-0000-0000-0000-000000000001', 'grade_3', 'english', 'מילים ראשונות', 1, null),
  ('dddddddd-0000-0000-0000-000000000002', 'grade_5', 'english', 'קריאה והבנה', 1, null),
  ('dddddddd-0000-0000-0000-000000000003', 'grade_3', 'bible', 'סיפורי בראשית', 1, null),
  ('dddddddd-0000-0000-0000-000000000004', 'grade_5', 'bible', 'דמויות בתנ״ך', 1, null),
  ('dddddddd-0000-0000-0000-000000000005', 'grade_3', 'geography', 'ארץ ישראל', 1, null),
  ('ffffffff-0000-0000-0000-000000000001', 'grade_5', 'future_skills', 'יזמות: מ‑MVP לשוק', 1, null),
  ('ffffffff-0000-0000-0000-000000000002', 'grade_5', 'science', 'אנרגיה וגוף האדם', 1, null),
  ('ffffffff-0000-0000-0000-000000000003', 'grade_5', 'geography', 'אקלים ויבשות', 1, null);

-- Questions
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- Mili (grade 3)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"כפל","stem":"כמה זה 7 × 6 ?","hint":"נסי לספור בקפיצות של 7: 7, 14, 21, 28… עד שש קפיצות. איפה נוחתים?","choices":[{"id":"a","text":"42"},{"id":"b","text":"48","misconception":"off_by_one_multiple"},{"id":"c","text":"36"},{"id":"d","text":"40"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"ברכות","stem":"איך אומרים \"שלום / היי\" בערבית מדוברת?","hint":"זו הברכה הראשונה שאומרים כשפוגשים מישהו. מתחילה ב-\"מ\".","choices":[{"id":"a","text":"מַרְחַבָּא"},{"id":"b","text":"שׁוּכְּרַן"},{"id":"c","text":"יַאללָה"},{"id":"d","text":"בַּסְטָה"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Lia (grade 5)
  ('bbbbbbbb-0000-0000-0000-000000000001', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"שברים","stem":"איזה שבר גדול יותר: 1/2 או 1/3 ?","hint":"תחשבי על פיצה: אם חותכים אותה ל-2 חתיכות או ל-3 חתיכות - באיזו חלוקה כל חתיכה גדולה יותר?","choices":[{"id":"a","text":"1/2"},{"id":"b","text":"1/3","misconception":"bigger_denominator_bigger_fraction"},{"id":"c","text":"הם שווים"},{"id":"d","text":"אי אפשר לדעת"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים \"סֵפֶר\" בערבית ספרותית?","hint":"המילה הזו מוכרת גם מהמילה \"מַכְּתַבָּה\" (סִפרייה) - אותו שורש.","choices":[{"id":"a","text":"כִּתַאבּ"},{"id":"b","text":"קַלַם","misconception":"confuse_pen_book"},{"id":"c","text":"בַּאבּ"},{"id":"d","text":"בֵּית"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Shared enrichment (both girls)
  ('aaaaaaaa-0000-0000-0000-000000000003', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"המצאות","stem":"מה הצעד הראשון של כל ממציאה חכמה?","hint":"לפני שממציאים פתרון צריך לדעת מה שווה לפתור. ממה אנשים מתעצבנים?","choices":[{"id":"a","text":"למצוא בעיה שמפריעה"},{"id":"b","text":"לצייר לוגו יפה"},{"id":"c","text":"לבחור שם מגניב"},{"id":"d","text":"לפתוח חנות"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'choice_scenario', 1, 'curated', 'auto_passed',
   '{"prompt":"מה תעשי היום בשביל מישהו אחר?","note":"אין כאן תשובה נכונה - כל בחירה היא הפקדה טובה ללב.","choices":[{"id":"a","label":"לפרגן לחברה על משהו","icon":"star"},{"id":"b","label":"לעזור במשהו בבית","icon":"home"},{"id":"c","label":"להקשיב לחברה בלי להפריע","icon":"ear"}]}'::jsonb);

-- Extra questions per topic - variety for "עוד מסע" and spaced review.
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- Mili math (grade 3)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"כפל","stem":"כמה זה 8 × 4 ?","hint":"ספרי בקפיצות של 8: 8, 16, 24… כמה קפיצות עד ארבע?","choices":[{"id":"a","text":"32"},{"id":"b","text":"28","misconception":"off_by_one_multiple"},{"id":"c","text":"36"},{"id":"d","text":"24"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"כפל","stem":"כמה זה 9 × 3 ?","hint":"9 ועוד 9 זה 18, ועוד 9 עוד פעם?","choices":[{"id":"a","text":"27"},{"id":"b","text":"24","misconception":"off_by_one_multiple"},{"id":"c","text":"21"},{"id":"d","text":"29"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Mili arabic spoken (grade 3)
  ('aaaaaaaa-0000-0000-0000-000000000002', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"ברכות","stem":"איך אומרים \"תודה\" בערבית מדוברת?","hint":"מילת נימוס נפוצה מאוד, מתחילה ב-\"שׁ\".","choices":[{"id":"a","text":"שׁוּכְּרַן"},{"id":"b","text":"מַרְחַבָּא"},{"id":"c","text":"מַעַ סַלַאמֶה"},{"id":"d","text":"עַפְוַן"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"ברכות","stem":"איך אומרים \"להתראות\" בערבית מדוברת?","hint":"אומרים את זה כשנפרדים - שתי מילים, מסתיים ב-\"סַלַאמֶה\".","choices":[{"id":"a","text":"מַעַ סַלַאמֶה"},{"id":"b","text":"שׁוּכְּרַן"},{"id":"c","text":"מַרְחַבָּא"},{"id":"d","text":"תְפַצַّ׳ל"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Shared future skills
  ('aaaaaaaa-0000-0000-0000-000000000003', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"המצאות","stem":"אחרי שמצאת בעיה - מה הצעד הבא של ממציאה?","hint":"לא מתאהבים ברעיון הראשון. מה עושים כדי לא לפספס רעיון טוב יותר?","choices":[{"id":"a","text":"לחשוב על כמה רעיונות שונים"},{"id":"b","text":"לבחור מיד את הרעיון הראשון"},{"id":"c","text":"לוותר אם זה קשה"},{"id":"d","text":"לחכות שמישהו אחר יפתור"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Lia math (grade 5)
  ('bbbbbbbb-0000-0000-0000-000000000001', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"שברים","stem":"כמה זה 1/4 + 1/4 ?","hint":"שני רבעים יחד - כמה זה מתוך שלם? אפשר לצמצם.","choices":[{"id":"a","text":"1/2"},{"id":"b","text":"1/8","misconception":"add_denominators"},{"id":"c","text":"1/4"},{"id":"d","text":"2/8"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"שברים","stem":"איזה שבר שווה ל-1/2 ?","hint":"מחפשים שבר שאם מצמצמים אותו מקבלים חצי.","choices":[{"id":"a","text":"2/4"},{"id":"b","text":"1/3"},{"id":"c","text":"2/3"},{"id":"d","text":"3/4"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Lia arabic literary (grade 5)
  ('bbbbbbbb-0000-0000-0000-000000000002', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים \"מים\" בערבית ספרותית?","hint":"מילה קצרה שמסתיימת בהברה פתוחה - \"...אא\".","choices":[{"id":"a","text":"מַאא׳"},{"id":"b","text":"שַׁמְס","misconception":"confuse_water_sun"},{"id":"c","text":"נַאר"},{"id":"d","text":"הַוַאא׳"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"אוצר מילים","stem":"מה הפירוש של המילה \"מַדְרַסֶה\"?","hint":"אותו שורש כמו \"דַרְס\" (שיעור). לאן הולכים ללמוד?","choices":[{"id":"a","text":"בית ספר"},{"id":"b","text":"בית חולים"},{"id":"c","text":"ספרייה"},{"id":"d","text":"גן חיות"}],"correct_choice_id":"a","coins":12}'::jsonb);

-- New subjects for the subject map (geometry, hebrew, science).
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- Geometry (grade 3)
  ('cccccccc-0000-0000-0000-000000000001', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"צורות","stem":"לכמה צלעות יש משולש?","hint":"הרמז נמצא בשם עצמו - \"מְשׁוּלָּשׁ\", כמו שלוש.","choices":[{"id":"a","text":"3"},{"id":"b","text":"4"},{"id":"c","text":"5"},{"id":"d","text":"2"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000001', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"צורות","stem":"לאיזו צורה יש 4 צלעות באותו אורך בדיוק?","hint":"כל הצלעות שוות וכל הזוויות ישרות.","choices":[{"id":"a","text":"ריבוע"},{"id":"b","text":"מלבן","misconception":"rectangle_is_square"},{"id":"c","text":"משולש"},{"id":"d","text":"עיגול"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Hebrew vocabulary (grade 3)
  ('cccccccc-0000-0000-0000-000000000002', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"מילים נרדפות","stem":"איזו מילה דומה במשמעות ל\"שָׂמֵחַ\"?","hint":"מחפשים מילה שאומרת בערך אותו דבר - הרגשה טובה.","choices":[{"id":"a","text":"עַלִּיז"},{"id":"b","text":"עָצוּב"},{"id":"c","text":"כּוֹעֵס"},{"id":"d","text":"עָיֵף"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000002', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"הפכים","stem":"מה ההפך מהמילה \"גָּדוֹל\"?","hint":"מה אומרים על משהו זעיר?","choices":[{"id":"a","text":"קָטָן"},{"id":"b","text":"רָחָב"},{"id":"c","text":"גָּבוֹהַּ"},{"id":"d","text":"כָּבֵד"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Geometry (grade 5)
  ('cccccccc-0000-0000-0000-000000000003', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"שטח","stem":"מה השטח של ריבוע שאורך צלעו 4 ס\"מ?","hint":"שטח ריבוע = צלע כפול צלע.","choices":[{"id":"a","text":"16"},{"id":"b","text":"8","misconception":"perimeter_instead_of_area"},{"id":"c","text":"12"},{"id":"d","text":"4"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"היקף","stem":"מה ההיקף של ריבוע שאורך צלעו 5 ס\"מ?","hint":"היקף = סכום כל ארבע הצלעות.","choices":[{"id":"a","text":"20"},{"id":"b","text":"25","misconception":"area_instead_of_perimeter"},{"id":"c","text":"10"},{"id":"d","text":"15"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Hebrew roots/spelling (grade 5)
  ('cccccccc-0000-0000-0000-000000000004', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"עובדה מול דעה","stem":"איזה משפט מבטא דעה, ולא עובדה?","hint":"עובדה אפשר לבדוק ולאמת; דעה מבטאת רגש או שיפוט אישי.","choices":[{"id":"a","text":"הספר הזה הוא הכי מרגש שנכתב אי פעם"},{"id":"b","text":"הספר יצא לאור בשנת 2019"},{"id":"c","text":"בספר יש 210 עמודים"},{"id":"d","text":"הספר תורגם לשבע שפות"}],"correct_choice_id":"a","coins":14}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000004', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"משמעות בהקשר","stem":"במשפט \"הילד קרא את הספר בנשימה עצורה\", למה הכוונה בביטוי \"בנשימה עצורה\"?","hint":"זה ביטוי - לא באמת מפסיקים לנשום. חושבים על התחושה.","choices":[{"id":"a","text":"במתח ובריכוז גדול"},{"id":"b","text":"תוך כדי ריצה","misconception":"literal_reading"},{"id":"c","text":"בשקט מוחלט"},{"id":"d","text":"במהירות רבה"}],"correct_choice_id":"a","coins":14}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000004', 'multiple_choice', 4, 'curated', 'auto_passed',
   '{"tag":"טיעון","stem":"\"כדאי ללכת ברגל לבית הספר כי זה בריא, חוסך זיהום אוויר, וגם נעים לפגוש חברים בדרך.\" מהי הטענה המרכזית?","hint":"הטענה היא המסקנה; שאר הדברים הם הנימוקים שתומכים בה.","choices":[{"id":"a","text":"כדאי ללכת ברגל לבית הספר"},{"id":"b","text":"הליכה היא בריאה"},{"id":"c","text":"נעים לפגוש חברים"},{"id":"d","text":"הליכה חוסכת זיהום אוויר"}],"correct_choice_id":"a","coins":14}'::jsonb),
  -- Science (shared enrichment)
  ('cccccccc-0000-0000-0000-000000000005', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"צמחים","stem":"מה נותן לצמח אנרגיה כדי לגדול?","hint":"בלי זה בבוקר לא היינו רואים כלום - וגם הצמח לא היה גדל.","choices":[{"id":"a","text":"אור השמש"},{"id":"b","text":"חושך"},{"id":"c","text":"רעש"},{"id":"d","text":"פלסטיק"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000005', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"בעלי חיים","stem":"איזו חיה היא יונק, למרות שהיא חיה בים?","hint":"היא נושמת אוויר, מניקה את גוריה, וקופצת מעל הגלים.","choices":[{"id":"a","text":"דולפין"},{"id":"b","text":"כריש","misconception":"shark_is_mammal"},{"id":"c","text":"צפרדע"},{"id":"d","text":"נחש"}],"correct_choice_id":"a","coins":10}'::jsonb);

-- Missing subjects: english, bible (cultural), geography.
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- English (grade 3)
  ('dddddddd-0000-0000-0000-000000000001', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים \"כלב\" באנגלית?","hint":"מילה קצרה בת שלוש אותיות, מתחילה ב-D.","choices":[{"id":"a","text":"Dog"},{"id":"b","text":"Cat","misconception":"confuse_dog_cat"},{"id":"c","text":"Fish"},{"id":"d","text":"Bird"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000001', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים \"ספר\" באנגלית?","hint":"מתחיל ב-B, וזה מה שאת קוראת.","choices":[{"id":"a","text":"Book"},{"id":"b","text":"Table"},{"id":"c","text":"Door"},{"id":"d","text":"Apple"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- English (grade 5)
  ('dddddddd-0000-0000-0000-000000000002', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"הבנה","stem":"מה הפירוש של המשפט \"I am happy\"?","hint":"happy = שמח.","choices":[{"id":"a","text":"אני שמח/ה"},{"id":"b","text":"אני עייף/ה"},{"id":"c","text":"אני רעב/ה"},{"id":"d","text":"אני עצוב/ה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000002', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"דקדוק","stem":"מה צורת הרבים של המילה \"child\" באנגלית?","hint":"זו מילה יוצאת דופן - לא מוסיפים סתם s.","choices":[{"id":"a","text":"children"},{"id":"b","text":"childs","misconception":"regular_plural_overgeneralization"},{"id":"c","text":"childes"},{"id":"d","text":"child"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Bible (grade 3, cultural)
  ('dddddddd-0000-0000-0000-000000000003', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"בראשית","stem":"מי בנה את התיבה לפי הסיפור?","hint":"אותו אדם אסף זוגות של כל בעלי החיים.","choices":[{"id":"a","text":"נח"},{"id":"b","text":"אברהם"},{"id":"c","text":"משה"},{"id":"d","text":"דוד"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000003', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"בראשית","stem":"בכמה ימים נברא העולם לפי הסיפור?","hint":"ביום השביעי נחו - אז כמה ימי בריאה היו?","choices":[{"id":"a","text":"שבעה"},{"id":"b","text":"שלושה"},{"id":"c","text":"עשרה"},{"id":"d","text":"אחד"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Bible (grade 5)
  ('dddddddd-0000-0000-0000-000000000004', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"דמויות","stem":"איזה מלך בנה את בית המקדש הראשון בירושלים?","hint":"בנו של דוד המלך, נודע בחוכמתו.","choices":[{"id":"a","text":"שלמה"},{"id":"b","text":"דוד","misconception":"david_built_temple"},{"id":"c","text":"שאול"},{"id":"d","text":"חזקיהו"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000004', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"דמויות","stem":"מי הייתה אחותם של משה ואהרן?","hint":"היא שמרה על משה כשהיה תינוק בתיבה על היאור.","choices":[{"id":"a","text":"מרים"},{"id":"b","text":"רות"},{"id":"c","text":"אסתר"},{"id":"d","text":"דבורה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Geography (shared enrichment)
  ('dddddddd-0000-0000-0000-000000000005', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"ארץ ישראל","stem":"מהי בירת ישראל?","hint":"עיר עתיקה עם החומות, במרכז הארץ.","choices":[{"id":"a","text":"ירושלים"},{"id":"b","text":"תל אביב","misconception":"largest_city_is_capital"},{"id":"c","text":"חיפה"},{"id":"d","text":"אילת"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000005', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"ארץ ישראל","stem":"איזה מקום בישראל הוא הנקודה הנמוכה ביותר ביבשה בעולם?","hint":"ים מלוח מאוד שאפשר לצוף בו בקלות.","choices":[{"id":"a","text":"ים המלח"},{"id":"b","text":"הכנרת"},{"id":"c","text":"הים התיכון"},{"id":"d","text":"ים סוף"}],"correct_choice_id":"a","coins":12}'::jsonb);

-- Grade-5 enrichment - deeper than the grade-3 versions (age-adapted).
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- Future skills (grade 5): entrepreneurship, MVP
  ('ffffffff-0000-0000-0000-000000000001', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"יזמות","stem":"מה זה MVP (מוצר ראשוני מינימלי)?","hint":"הגרסה הכי פשוטה שאפשר להוציא כדי לבדוק אם הרעיון עובד - לפני שמשקיעים הרבה.","choices":[{"id":"a","text":"גרסה ראשונית ופשוטה שבודקים איתה אם הרעיון עובד"},{"id":"b","text":"המוצר המושלם והסופי"},{"id":"c","text":"הפרסומת של המוצר"},{"id":"d","text":"השם של החברה"}],"correct_choice_id":"a","coins":14}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000001', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"יזמות","stem":"למה כדאי לעשות סקר שוק לפני שמפתחים מוצר?","hint":"עדיף לגלות מה אנשים באמת צריכים לפני שמשקיעים זמן וכסף.","choices":[{"id":"a","text":"כדי לבדוק אם יש אנשים שבאמת רוצים את המוצר"},{"id":"b","text":"כדי לבחור צבע ללוגו"},{"id":"c","text":"כדי לחסוך בחשמל"},{"id":"d","text":"כי זה מה שכולם עושים"}],"correct_choice_id":"a","coins":14}'::jsonb),
  -- Science (grade 5): energy + human body
  ('ffffffff-0000-0000-0000-000000000002', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"אנרגיה","stem":"איזו המרת אנרגיה מתרחשת בפנס שעובד על סוללה?","hint":"בסוללה אצורה אנרגיה כימית; הפנס בסוף נותן אור.","choices":[{"id":"a","text":"מאנרגיה כימית לאנרגיית אור"},{"id":"b","text":"מאנרגיית אור לאנרגיה כימית"},{"id":"c","text":"מאנרגיית קול לחום"},{"id":"d","text":"מאנרגיית תנועה לקול"}],"correct_choice_id":"a","coins":14}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000002', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"גוף האדם","stem":"מה תפקיד הריאות בגוף?","hint":"קשור לנשימה - מה נכנס ומה יוצא מהגוף.","choices":[{"id":"a","text":"להכניס חמצן לגוף ולהוציא פחמן דו-חמצני"},{"id":"b","text":"לעכל את האוכל"},{"id":"c","text":"לשאוב את הדם"},{"id":"d","text":"לסנן פסולת מהדם"}],"correct_choice_id":"a","coins":14}'::jsonb),
  -- Geography (grade 5): climate + continents
  ('ffffffff-0000-0000-0000-000000000003', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"יבשות","stem":"כמה יבשות יש בכדור הארץ?","hint":"אסיה, אפריקה, אירופה, אמריקה הצפונית והדרומית, אוסטרליה ואנטארקטיקה.","choices":[{"id":"a","text":"שבע"},{"id":"b","text":"חמש"},{"id":"c","text":"שש"},{"id":"d","text":"תשע"}],"correct_choice_id":"a","coins":14}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000003', 'multiple_choice', 4, 'curated', 'auto_passed',
   '{"tag":"אקלים","stem":"מהו אקלים ים-תיכוני, כמו בישראל?","hint":"תחשבי על מזג האוויר לאורך השנה - מתי גשום ומתי חם ויבש.","choices":[{"id":"a","text":"חורף גשום וקריר, קיץ חם ויבש"},{"id":"b","text":"גשום וקר כל השנה"},{"id":"c","text":"חם וגשום כל השנה"},{"id":"d","text":"שלג רוב השנה"}],"correct_choice_id":"a","coins":16}'::jsonb);

-- Leadership worlds ("אי המצפן"): reflective micro-missions, no right/wrong.
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'reflection_log', 1, 'curated', 'auto_passed',
   '{"world":1,"kind":"reflection","prompt":"איזו פעולה קטנה עשית היום שמקרבת אותך למי שאת רוצה להיות?","note":"אין כאן תשובה נכונה - כל חותמת מקדמת אותך.","options":[{"id":"hobby","label":"התמדתי בתחביב שאני אוהבת","icon":"star"},{"id":"friend","label":"הייתי חברה טובה","icon":"heart"},{"id":"brave","label":"ניסיתי משהו חדש שהפחיד אותי","icon":"spark"},{"id":"grow","label":"למדתי משהו בעצמי","icon":"book"}]}'::jsonb),
  ('eeeeeeee-0000-0000-0000-000000000002', 'budget_allocation', 1, 'curated', 'auto_passed',
   '{"world":2,"kind":"budget","prompt":"יש לך היום 5 חלקים של זמן פנוי. איך תחלקי אותם?","coins":5,"note":"אי אפשר הכל - לבחור משהו זה גם להגיד ''כן'' לעצמך.","options":[{"id":"club","label":"חוג","icon":"star"},{"id":"screen","label":"מסך","icon":"spark"},{"id":"rest","label":"מנוחה","icon":"heart"},{"id":"friend","label":"זמן עם חברה","icon":"home"}]}'::jsonb),
  ('eeeeeeee-0000-0000-0000-000000000003', 'choice_scenario', 1, 'curated', 'auto_passed',
   '{"world":3,"kind":"scenario","prompt":"חברה מבקשת שתכיני בשבילה שיעורי בית, ואת עמוסה. איך תגידי ''לא'' בצורה יפה?","note":"סירוב מנומס הוא כוח, לא מרד.","choices":[{"id":"a","label":"אני לא יכולה היום - בא לך שנעשה יחד בפעם אחרת?","icon":"star"},{"id":"b","label":"אני עמוסה עכשיו, אבל אשמח לעזור לך להבין משהו קטן","icon":"home"},{"id":"c","label":"היום אני צריכה את הזמן שלי, סבבה?","icon":"ear"}]}'::jsonb);

-- Reward store (shared family catalog) - varied prices, one screen-time option
insert into reward_store (family_id, title, category, cost_coins) values
  ('11111111-1111-1111-1111-111111111111', 'לבחור את המוזיקה ברכב', 'privilege', 20),
  ('11111111-1111-1111-1111-111111111111', 'לבחור את סרט המשפחה', 'privilege', 40),
  ('11111111-1111-1111-1111-111111111111', 'קינוח מיוחד לבחירתך', 'experience', 55),
  ('11111111-1111-1111-1111-111111111111', 'לבחור את ארוחת הערב', 'privilege', 70),
  ('11111111-1111-1111-1111-111111111111', 'חצי שעה זמן מסך', 'screen_time', 90),
  ('11111111-1111-1111-1111-111111111111', 'ערב משחקי קופסה עם ההורים', 'family_activity', 110),
  ('11111111-1111-1111-1111-111111111111', 'לישון מאוחר יותר בסוף שבוע', 'privilege', 130),
  ('11111111-1111-1111-1111-111111111111', 'יציאה לגלידה', 'experience', 160),
  ('11111111-1111-1111-1111-111111111111', 'לבחור פעילות משפחתית לסוף שבוע', 'family_activity', 200),
  ('11111111-1111-1111-1111-111111111111', 'ספר או צעצוע קטן', 'physical_item', 260),
  ('11111111-1111-1111-1111-111111111111', 'יום כיף מיוחד', 'experience', 350);

-- ─────────────── Avatar shop (premium items, bought with coins) ───────────────
-- svg_layer.value must match the id the Avatar renderer + editor expect
-- (accessory_id / hairstyle_id). Stable UUIDs so re-running the seed is idempotent.
insert into avatar_items (id, slot, name, svg_layer, unlock_type, cost_coins) values
  ('a0a00000-0000-4000-8000-000000000001', 'accessory', 'פרח בשיער',
   '{"value":"flower","label":"פרח","emoji":"🌸"}'::jsonb, 'coins', 25),
  ('a0a00000-0000-4000-8000-000000000002', 'hairstyle', 'תסרוקת קוקו',
   '{"value":"ponytail","label":"קוקו","emoji":"💇‍♀️"}'::jsonb, 'coins', 30),
  ('a0a00000-0000-4000-8000-000000000003', 'accessory', 'אוזניות',
   '{"value":"headphones","label":"אוזניות","emoji":"🎧"}'::jsonb, 'coins', 35),
  ('a0a00000-0000-4000-8000-000000000004', 'accessory', 'כתר מלכה',
   '{"value":"crown","label":"כתר","emoji":"👑"}'::jsonb, 'coins', 45)
on conflict (id) do update set
  slot = excluded.slot, name = excluded.name, svg_layer = excluded.svg_layer,
  unlock_type = excluded.unlock_type, cost_coins = excluded.cost_coins;

-- ─────────── Bigger core banks: real session length without waiting on AI ───────────
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- Math grade 3 - לוח הכפל
  ('aaaaaaaa-0000-0000-0000-000000000001', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"כפל","stem":"כמה זה 6 × 6 ?","hint":"שש קפיצות של 6.","hints":["ספרי 6, 12, 18…","עוד שלוש קפיצות אחרי 18: 24, 30, 36"],"explanation":"6 כפול 6 שווה 36.","choices":[{"id":"a","text":"36"},{"id":"b","text":"30","misconception":"off_by_one_multiple"},{"id":"c","text":"42"},{"id":"d","text":"12"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"כפל","stem":"כמה זה 7 × 8 ?","hint":"אפשר 7×8 = 7×4 ועוד 7×4.","hints":["7×4 = 28","28 ועוד 28 = 56"],"explanation":"7 כפול 8 שווה 56.","choices":[{"id":"a","text":"56"},{"id":"b","text":"54","misconception":"off_by_one_multiple"},{"id":"c","text":"64"},{"id":"d","text":"49"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"כפל","stem":"בכיתה יש 4 שורות ובכל שורה 6 כיסאות. כמה כיסאות בסך הכל?","hint":"4 קבוצות של 6.","hints":["זה 4 × 6","6, 12, 18, 24"],"explanation":"4 שורות כפול 6 כיסאות = 24.","choices":[{"id":"a","text":"24"},{"id":"b","text":"10"},{"id":"c","text":"46"},{"id":"d","text":"20"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"כפל","stem":"כמה זה 9 × 6 ?","hint":"9 זה כמו 10 פחות 1.","hints":["10 × 6 = 60","60 פחות 6 = 54"],"explanation":"9 כפול 6 שווה 54.","choices":[{"id":"a","text":"54"},{"id":"b","text":"56","misconception":"off_by_one_multiple"},{"id":"c","text":"63"},{"id":"d","text":"48"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Math grade 5 - שברים
  ('bbbbbbbb-0000-0000-0000-000000000001', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"שברים","stem":"איזה שבר שווה ל‑2/4 ?","hint":"נסי לצמצם - לחלק מונה ומכנה באותו מספר.","hints":["חלקי את 2 ואת 4 ב‑2","2÷2=1, 4÷2=2"],"explanation":"2/4 מצטמצם ל‑1/2.","choices":[{"id":"a","text":"1/2"},{"id":"b","text":"1/4"},{"id":"c","text":"2/3"},{"id":"d","text":"1/3"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"שברים","stem":"כמה זה 1/4 + 2/4 ?","hint":"אותו מכנה - מחברים רק את המונים.","hints":["1+2 = 3","המכנה נשאר 4"],"explanation":"מחברים מונים כשהמכנה זהה: 1/4+2/4 = 3/4.","choices":[{"id":"a","text":"3/4"},{"id":"b","text":"3/8","misconception":"add_denominators"},{"id":"c","text":"1/2"},{"id":"d","text":"2/4"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"שברים","stem":"מה זה 3/5 מתוך 20 ?","hint":"קודם מוצאים חמישית אחת מ‑20.","hints":["20 ÷ 5 = 4 (זה 1/5)","3 חמישיות = 3 × 4"],"explanation":"1/5 מ‑20 הוא 4, ולכן 3/5 הם 12.","choices":[{"id":"a","text":"12"},{"id":"b","text":"15"},{"id":"c","text":"8"},{"id":"d","text":"60"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'multiple_choice', 4, 'curated', 'auto_passed',
   '{"tag":"שברים","stem":"איזה שבר גדול יותר: 3/4 או 2/3 ?","hint":"אפשר להביא למכנה משותף 12.","hints":["3/4 = 9/12","2/3 = 8/12"],"explanation":"3/4 שווה 9/12 והוא גדול מ‑8/12 (שהם 2/3).","choices":[{"id":"a","text":"3/4"},{"id":"b","text":"2/3","misconception":"bigger_denominator_bigger_fraction"},{"id":"c","text":"הם שווים"},{"id":"d","text":"אי אפשר לדעת"}],"correct_choice_id":"a","coins":13}'::jsonb),
  -- Hebrew grade 3 - אוצר מילים
  ('cccccccc-0000-0000-0000-000000000002', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"ניגודים","stem":"מה ההפך של המילה \"גָּדוֹל\" ?","hint":"תחשבי על משהו זעיר.","hints":["הפך של גדול קשור לגודל","נמלה היא… ?"],"explanation":"ההפך של גדול הוא קטן.","choices":[{"id":"a","text":"קָטָן"},{"id":"b","text":"רָחָב"},{"id":"c","text":"כָּבֵד"},{"id":"d","text":"גָּבוֹהַּ"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000002', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"מילים נרדפות","stem":"איזו מילה דומה במשמעות ל\"שָׂמֵחַ\" ?","hint":"מילה נרדפת = אותה משמעות במילה אחרת.","hints":["מחפשים רגש טוב","עַלִּיז זה כמו…"],"explanation":"עליז הוא מילה נרדפת לשמח.","choices":[{"id":"a","text":"עַלִּיז"},{"id":"b","text":"עָצוּב"},{"id":"c","text":"רָעֵב"},{"id":"d","text":"עָיֵף"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000002', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"יחיד ורבים","stem":"מה צורת הרבים של \"יֶלֶד\" ?","hint":"יותר מאחד.","hints":["מוסיפים סיומת רבים","ילד אחד, שני…"],"explanation":"הרבים של ילד הוא ילדים.","choices":[{"id":"a","text":"יְלָדִים"},{"id":"b","text":"יַלְדָּה"},{"id":"c","text":"יַלְדּוּת"},{"id":"d","text":"יְלָדוֹת"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000002', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"הקשר","stem":"בְּמשפט \"הילד רָץ מהר כי אֵיחר לבית הספר\" - למה הוא רץ?","hint":"חפשי את הסיבה אחרי המילה \"כי\".","hints":["המילה כי מציגה סיבה","מה קרה עם הזמן?"],"explanation":"המילה כי מציגה את הסיבה: הוא איחר.","choices":[{"id":"a","text":"כי הוא איחר"},{"id":"b","text":"כי הוא רעב"},{"id":"c","text":"כי חם בחוץ"},{"id":"d","text":"כי הוא שמח"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- Hebrew grade 5 - הבנה וטיעון
  ('cccccccc-0000-0000-0000-000000000004', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"עובדה ודעה","stem":"איזה משפט הוא דעה (ולא עובדה)?","hint":"דעה אפשר להתווכח עליה; עובדה אפשר לבדוק.","hints":["חפשי משפט שתלוי בטעם אישי","מילים כמו הכי/יפה מרמזות על דעה"],"explanation":"\"הגלידה הכי טעימה\" היא דעה - היא תלויה בטעם אישי.","choices":[{"id":"a","text":"גלידת השוקולד היא הכי טעימה שיש"},{"id":"b","text":"מים קופאים ב‑0 מעלות"},{"id":"c","text":"בשבוע יש שבעה ימים"},{"id":"d","text":"ישראל נמצאת באסיה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000004', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"טיעון","stem":"\"כדאי ללכת לישון מוקדם, כי מי שישן טוב מרוכז יותר בבוקר.\" מה הנימוק בטענה?","hint":"הנימוק מסביר למה כדאי.","hints":["חפשי את החלק אחרי המילה כי","מה היתרון שמצוין?"],"explanation":"הנימוק הוא שמי שישן טוב מרוכז יותר בבוקר.","choices":[{"id":"a","text":"מי שישן טוב מרוכז יותר בבוקר"},{"id":"b","text":"כדאי ללכת לישון מוקדם"},{"id":"c","text":"הבוקר מגיע מהר"},{"id":"d","text":"שינה זה משעמם"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000004', 'multiple_choice', 4, 'curated', 'auto_passed',
   '{"tag":"משמעות בהקשר","stem":"\"אחרי המרוץ הארוך, רגליו היו כְּבֵדוֹת כעופרת.\" למה הכוונה?","hint":"זו לשון ציורית, לא משקל ממש.","hints":["רגליים לא נעשות מעופרת באמת","איך מרגישות רגליים אחרי מאמץ?"],"explanation":"הכוונה שהיה לו קשה מאוד להזיז את הרגליים מרוב עייפות.","choices":[{"id":"a","text":"היה לו קשה מאוד להזיז את הרגליים"},{"id":"b","text":"הרגליים שלו עשויות ממתכת"},{"id":"c","text":"הוא שקל הרבה"},{"id":"d","text":"הוא רץ מהר מאוד"}],"correct_choice_id":"a","coins":13}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000004', 'multiple_choice', 4, 'curated', 'auto_passed',
   '{"tag":"הסקת מסקנות","stem":"\"בבוקר הרחוב היה רטוב והמטריות היו פתוחות.\" מה אפשר להסיק?","hint":"אילו סימנים מצוינים?","hints":["מה גורם לרחוב רטוב?","למה פותחים מטריות?"],"explanation":"מהסימנים אפשר להסיק שירד גשם.","choices":[{"id":"a","text":"ירד גשם"},{"id":"b","text":"הייתה שריפה"},{"id":"c","text":"היה חג"},{"id":"d","text":"נפל שלג"}],"correct_choice_id":"a","coins":13}'::jsonb),
  -- Bible grade 3 - סיפורי בראשית
  ('dddddddd-0000-0000-0000-000000000003', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"בריאה","stem":"בכמה ימים נברא העולם לפי סיפור הבריאה?","hint":"ששה ימי מעשה ויום מנוחה.","hints":["ביום השביעי נחו","6 + 1"],"explanation":"העולם נברא בששה ימים וביום השביעי שבת.","choices":[{"id":"a","text":"שבעה"},{"id":"b","text":"שלושה"},{"id":"c","text":"עשרה"},{"id":"d","text":"חמישה"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000003', 'multiple_choice', 1, 'curated', 'auto_passed',
   '{"tag":"נח","stem":"מי בנה תיבה כדי להינצל מהמבול?","hint":"הוא אסף זוגות של בעלי חיים.","hints":["השם מתחיל ב‑נ","נח בן…"],"explanation":"נח בנה את התיבה ואסף אליה זוגות מכל בעלי החיים.","choices":[{"id":"a","text":"נֹחַ"},{"id":"b","text":"אברהם"},{"id":"c","text":"משה"},{"id":"d","text":"יוסף"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000003', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"אבות","stem":"מי הם שלושת האבות של עם ישראל?","hint":"סבא, אבא ונכד.","hints":["הראשון הוא אברהם","אברהם, יצחק ו…"],"explanation":"האבות הם אברהם, יצחק ויעקב.","choices":[{"id":"a","text":"אברהם, יצחק ויעקב"},{"id":"b","text":"משה, אהרן ומרים"},{"id":"c","text":"נח, שם וחם"},{"id":"d","text":"דוד, שלמה ושאול"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000003', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"גן עדן","stem":"מאיזה עץ נאסר על אדם וחוה לאכול בגן עדן?","hint":"עץ עם שם שקשור לדעת.","hints":["לא עץ החיים","עץ הַ…"],"explanation":"נאסר עליהם לאכול מעץ הדעת טוב ורע.","choices":[{"id":"a","text":"עץ הדעת טוב ורע"},{"id":"b","text":"עץ הזית"},{"id":"c","text":"עץ התאנה"},{"id":"d","text":"עץ הרימון"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Bible grade 5 - דמויות בתנ״ך
  ('dddddddd-0000-0000-0000-000000000004', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"יוסף","stem":"מי פתר את חלומות פרעה במצרים?","hint":"הוא הגיע למצרים אחרי שאחיו מכרו אותו.","hints":["בעל כתונת הפסים","יעקב היה אביו"],"explanation":"יוסף פתר את חלומות פרעה ועלה לגדולה במצרים.","choices":[{"id":"a","text":"יוסף"},{"id":"b","text":"משה"},{"id":"c","text":"אהרן"},{"id":"d","text":"יהודה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000004', 'multiple_choice', 2, 'curated', 'auto_passed',
   '{"tag":"דוד","stem":"את מי ניצח דוד הצעיר בעזרת קלע ואבן?","hint":"ענק פלשתי.","hints":["הפלשתי הענק מגת","שמו מתחיל ב‑ג"],"explanation":"דוד ניצח את גלית הפלשתי בעזרת קלע ואבן.","choices":[{"id":"a","text":"גָּלְיָת"},{"id":"b","text":"שאול"},{"id":"c","text":"עֵשָׂו"},{"id":"d","text":"פרעה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000004', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"מנהיגות","stem":"מי הוציא את בני ישראל ממצרים אל החירות?","hint":"הוא קיבל את הלוחות בהר סיני.","hints":["גדל בבית פרעה","שמו מתחיל ב‑מ"],"explanation":"משה הנהיג את בני ישראל ביציאת מצרים.","choices":[{"id":"a","text":"משה"},{"id":"b","text":"יהושע"},{"id":"c","text":"שלמה"},{"id":"d","text":"שמואל"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000004', 'multiple_choice', 3, 'curated', 'auto_passed',
   '{"tag":"חוכמה","stem":"איזה מלך נודע בחוכמתו ובבניית בית המקדש הראשון?","hint":"בנו של דוד.","hints":["שפט בין שתי הנשים","שמו מתחיל ב‑ש"],"explanation":"שלמה המלך נודע בחוכמתו ובנה את בית המקדש הראשון.","choices":[{"id":"a","text":"שלמה"},{"id":"b","text":"שאול"},{"id":"c","text":"דוד"},{"id":"d","text":"רחבעם"}],"correct_choice_id":"a","coins":12}'::jsonb);

-- English / Arabic / Science expansion (mirrors fill_lang_science.sql)
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- English grade 3 - מילים ראשונות
  ('dddddddd-0000-0000-0000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים בית באנגלית?","hints":["מילה עם 5 אותיות","מתחילה ב‑H"],"explanation":"בית באנגלית הוא House.","choices":[{"id":"a","text":"House"},{"id":"b","text":"Mouse"},{"id":"c","text":"Horse"},{"id":"d","text":"Hat"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag":"צבעים","stem":"איזו מילה פירושה אדום?","hints":["צבע חם","מתחילה ב‑R"],"explanation":"אדום באנגלית הוא Red.","choices":[{"id":"a","text":"Red"},{"id":"b","text":"Blue"},{"id":"c","text":"Green"},{"id":"d","text":"Read"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag":"בעלי חיים","stem":"איך אומרים כלב באנגלית?","hints":["חיה שנובחת","3 אותיות"],"explanation":"כלב באנגלית הוא Dog.","choices":[{"id":"a","text":"Dog"},{"id":"b","text":"Cat"},{"id":"c","text":"Cow"},{"id":"d","text":"Dig"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"אוצר מילים","stem":"מה זה Apple בעברית?","hints":["פרי","גדל על עץ"],"explanation":"Apple פירושו תפוח.","choices":[{"id":"a","text":"תפוח"},{"id":"b","text":"בננה"},{"id":"c","text":"תפוז"},{"id":"d","text":"ענב"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- English grade 5 - קריאה והבנה
  ('dddddddd-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"דקדוק","stem":"What is the past tense of go?","hints":["לא הולך אלא הלך","צורה לא רגילה"],"explanation":"עבר של go הוא went (פועל חריג).","choices":[{"id":"a","text":"went"},{"id":"b","text":"goed"},{"id":"c","text":"gone"},{"id":"d","text":"going"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"דקדוק","stem":"Choose the correct sentence:","hints":["גוף שלישי יחיד בהווה מוסיף s","She + פועל+s"],"explanation":"בגוף שלישי יחיד בהווה הפועל מקבל s: She goes.","choices":[{"id":"a","text":"She goes to school every day"},{"id":"b","text":"She go to school every day"},{"id":"c","text":"She going to school every day"},{"id":"d","text":"She gone to school every day"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אוצר מילים","stem":"What is the opposite of happy?","hints":["רגש הפוך","מתחיל ב‑s"],"explanation":"ההפך של happy (שמח) הוא sad (עצוב).","choices":[{"id":"a","text":"sad"},{"id":"b","text":"glad"},{"id":"c","text":"angry"},{"id":"d","text":"tired"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000002','multiple_choice',4,'curated','auto_passed',
   '{"tag":"רבים","stem":"What is the plural of child?","hints":["רבים חריג","לא childs"],"explanation":"הרבים של child הוא children (צורה חריגה).","choices":[{"id":"a","text":"children"},{"id":"b","text":"childs"},{"id":"c","text":"childes"},{"id":"d","text":"child"}],"correct_choice_id":"a","coins":13}'::jsonb),
  -- Arabic grade 3 - ברכות (מדוברת)
  ('aaaaaaaa-0000-0000-0000-000000000002','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ברכות","stem":"איך אומרים תודה בערבית מדוברת?","hints":["אומרים כשמישהו עוזר","מתחיל ב‑שֻׁ"],"explanation":"תודה בערבית מדוברת: שֻׁכְּרַן.","choices":[{"id":"a","text":"שֻׁכְּרַן"},{"id":"b","text":"מַרְחַבָּא"},{"id":"c","text":"מַע אַלסַّלַאמֶה"},{"id":"d","text":"עַפְוַן"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ברכות","stem":"איך אומרים להתראות בערבית מדוברת?","hints":["נפרדים בזה","שלוש מילים"],"explanation":"להתראות: מַע אַלסַّלַאמֶה.","choices":[{"id":"a","text":"מַע אַלסַّלַאמֶה"},{"id":"b","text":"שֻׁכְּרַן"},{"id":"c","text":"מִן פַצְ׳לַכּ"},{"id":"d","text":"כֵּיף חַאלַכּ"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag":"ברכות","stem":"איך אומרים בוקר טוב בערבית מדוברת?","hints":["ברכת בוקר","המילה צַבַּאח = בוקר"],"explanation":"בוקר טוב: צַבַּאח אֶלחֵ׳יר.","choices":[{"id":"a","text":"צַבַּאח אֶלחֵ׳יר"},{"id":"b","text":"מַסַאא אֶלחֵ׳יר"},{"id":"c","text":"תֻצְבִּח עַלַא חֵ׳יר"},{"id":"d","text":"אַהְלַן"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag":"מילים","stem":"מה פירוש המילה אַיְוַה בערבית מדוברת?","hints":["תשובה קצרה","הפך של לא"],"explanation":"אַיְוַה פירושו כן.","choices":[{"id":"a","text":"כן"},{"id":"b","text":"לא"},{"id":"c","text":"אולי"},{"id":"d","text":"תודה"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Arabic grade 5 - קריאה ספרותית (ספרותית)
  ('bbbbbbbb-0000-0000-0000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים מים בערבית ספרותית?","hints":["מה שותים","מתחיל ב‑מَ"],"explanation":"מים בערבית ספרותית: מַאء.","choices":[{"id":"a","text":"מַאء"},{"id":"b","text":"שַׁמְס"},{"id":"c","text":"בַּיְת"},{"id":"d","text":"נַאר"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים בית בערבית ספרותית?","hints":["גרים בו","מתחיל ב‑בَ"],"explanation":"בית בערבית ספרותית: בַּיְת.","choices":[{"id":"a","text":"בַּיְת"},{"id":"b","text":"בַּאב"},{"id":"c","text":"כִּתַאבּ"},{"id":"d","text":"מַדְרַסֶה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אוצר מילים","stem":"מה פירוש המילה שַׁמְס בערבית?","hints":["מאירה ביום","בשמיים"],"explanation":"שַׁמְס פירושו שמש.","choices":[{"id":"a","text":"שמש"},{"id":"b","text":"ירח"},{"id":"c","text":"כוכב"},{"id":"d","text":"ענן"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אוצר מילים","stem":"איך אומרים מורה בערבית ספרותית?","hints":["מלמד בכיתה","מאותו שורש כמו מַדְרַסֶה"],"explanation":"מורה בערבית ספרותית: מֻעַלִّם.","choices":[{"id":"a","text":"מֻעַלִّם"},{"id":"b","text":"טַאלִבּ"},{"id":"c","text":"טַבִּיבּ"},{"id":"d","text":"כַּאתִבּ"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Science grade 3 - עולם החי
  ('cccccccc-0000-0000-0000-000000000005','multiple_choice',1,'curated','auto_passed',
   '{"tag":"בעלי חיים","stem":"כמה רגליים יש לחרק?","hints":["יותר מארבע","זוג לכל חלק גוף - שלושה זוגות"],"explanation":"לחרקים יש שש רגליים.","choices":[{"id":"a","text":"שש"},{"id":"b","text":"ארבע"},{"id":"c","text":"שמונה"},{"id":"d","text":"שתיים"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag":"בעלי חיים","stem":"באיזה איבר נושם דג במים?","hints":["לא ריאות","נמצא בצדי הראש"],"explanation":"דגים נושמים דרך הזימים.","choices":[{"id":"a","text":"זימים"},{"id":"b","text":"ריאות"},{"id":"c","text":"עור"},{"id":"d","text":"סנפיר"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag":"צמחים","stem":"מה צמח צריך כדי לגדול?","hints":["מגיע מהשמש ומהגשם","שני דברים"],"explanation":"צמח צריך אור שמש ומים (וגם אוויר) כדי לגדול.","choices":[{"id":"a","text":"אור שמש ומים"},{"id":"b","text":"חושך וקור"},{"id":"c","text":"רק אבנים"},{"id":"d","text":"רק חשמל"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag":"בעלי חיים","stem":"איזו קבוצת בעלי חיים מטילה ביצים?","hints":["לא יונקים","ציפורים ו…"],"explanation":"ציפורים (וגם זוחלים ודגים) מטילות ביצים; יונקים יולדים.","choices":[{"id":"a","text":"ציפורים"},{"id":"b","text":"כלבים"},{"id":"c","text":"חתולים"},{"id":"d","text":"סוסים"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Science grade 5 - אנרגיה וגוף האדם
  ('ffffffff-0000-0000-0000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag":"גוף האדם","stem":"איזה איבר שואב את הדם בגוף?","hints":["פועם בחזה","שריר חזק"],"explanation":"הלב שואב את הדם דרך כלי הדם.","choices":[{"id":"a","text":"הלב"},{"id":"b","text":"הכבד"},{"id":"c","text":"הריאות"},{"id":"d","text":"הקיבה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"גוף האדם","stem":"איזו מערכת בגוף אחראית לפירוק המזון?","hints":["מתחילה בפה","קשורה לקיבה ולמעיים"],"explanation":"מערכת העיכול מפרקת את המזון לרכיבים שהגוף סופג.","choices":[{"id":"a","text":"מערכת העיכול"},{"id":"b","text":"מערכת הנשימה"},{"id":"c","text":"מערכת הדם"},{"id":"d","text":"מערכת השלד"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אנרגיה","stem":"מהו מקור האנרגיה העיקרי של כדור הארץ?","hints":["נמצא בשמיים ביום","נותן אור וחום"],"explanation":"השמש היא מקור האנרגיה העיקרי (אור וחום) לכדור הארץ.","choices":[{"id":"a","text":"השמש"},{"id":"b","text":"הירח"},{"id":"c","text":"הרוח בלבד"},{"id":"d","text":"הכוכבים הרחוקים"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אנרגיה","stem":"מה קורה לאנרגיה כשמדליקים מנורה חשמלית?","hints":["נכנס חשמל, יוצא אור","המרת אנרגיה"],"explanation":"במנורה אנרגיה חשמלית הופכת לאנרגיית אור (וגם קצת חום).","choices":[{"id":"a","text":"אנרגיה חשמלית הופכת לאור"},{"id":"b","text":"אור הופך לחשמל"},{"id":"c","text":"קול הופך לאור"},{"id":"d","text":"לא קורה כלום"}],"correct_choice_id":"a","coins":12}'::jsonb);

-- Geometry / Geography / Future-skills expansion (mirrors fill_more.sql)
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- Geometry g3 - צורות
  ('cccccccc-0000-0000-0000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag":"צורות","stem":"לאיזו צורה יש 3 צלעות?","hints":["פחות מריבוע","כמו פירמידה מהצד"],"explanation":"למשולש יש 3 צלעות.","choices":[{"id":"a","text":"משולש"},{"id":"b","text":"ריבוע"},{"id":"c","text":"עיגול"},{"id":"d","text":"מחומש"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag":"צורות","stem":"איזו צורה עגולה ואין לה פינות בכלל?","hints":["כמו גלגל","אין קודקודים"],"explanation":"למעגל אין פינות.","choices":[{"id":"a","text":"מעגל"},{"id":"b","text":"ריבוע"},{"id":"c","text":"משולש"},{"id":"d","text":"מלבן"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"צורות","stem":"כמה פינות (קודקודים) יש למשולש?","hints":["כמו מספר הצלעות","3"],"explanation":"למשולש יש 3 קודקודים.","choices":[{"id":"a","text":"שלוש"},{"id":"b","text":"ארבע"},{"id":"c","text":"שתיים"},{"id":"d","text":"חמש"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Geometry g5 - שטח והיקף
  ('cccccccc-0000-0000-0000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag":"שטח","stem":"מה שטח ריבוע שאורך צלעו 4 ס״מ?","hints":["שטח ריבוע = צלע כפול צלע","4×4"],"explanation":"שטח ריבוע = צלע×צלע = 4×4 = 16.","choices":[{"id":"a","text":"16 סמ״ר"},{"id":"b","text":"8 סמ״ר"},{"id":"c","text":"12 סמ״ר"},{"id":"d","text":"20 סמ״ר"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003','multiple_choice',3,'curated','auto_passed',
   '{"tag":"היקף","stem":"מה היקף מלבן שאורכו 5 ורוחבו 3?","hints":["היקף = לחבר את כל הצלעות","5+3+5+3"],"explanation":"היקף = 2×(5+3) = 16.","choices":[{"id":"a","text":"16"},{"id":"b","text":"15"},{"id":"c","text":"8"},{"id":"d","text":"11"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003','multiple_choice',3,'curated','auto_passed',
   '{"tag":"שטח","stem":"מה שטח מלבן שאורכו 6 ורוחבו 3?","hints":["שטח מלבן = אורך כפול רוחב","6×3"],"explanation":"שטח מלבן = 6×3 = 18.","choices":[{"id":"a","text":"18"},{"id":"b","text":"9"},{"id":"c","text":"12"},{"id":"d","text":"24"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Geography g3 - ארץ ישראל
  ('dddddddd-0000-0000-0000-000000000005','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ערים","stem":"מהי בירת ישראל?","hints":["בה נמצא הכנסת","עיר הקודש"],"explanation":"בירת ישראל היא ירושלים.","choices":[{"id":"a","text":"ירושלים"},{"id":"b","text":"תל אביב"},{"id":"c","text":"חיפה"},{"id":"d","text":"אילת"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag":"מים","stem":"איזה ים נמצא במערב ישראל?","hints":["לאורך חופי תל אביב וחיפה","הכי גדול"],"explanation":"במערב ישראל נמצא הים התיכון.","choices":[{"id":"a","text":"הים התיכון"},{"id":"b","text":"ים המלח"},{"id":"c","text":"ים סוף"},{"id":"d","text":"הכנרת"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag":"מים","stem":"הכנרת היא מקור מים חשוב. מה היא?","hints":["ממנה שותים מים מתוקים","לא ים מלוח"],"explanation":"הכנרת היא אגם מים מתוקים.","choices":[{"id":"a","text":"אגם מים מתוקים"},{"id":"b","text":"ים מלוח"},{"id":"c","text":"מדבר"},{"id":"d","text":"נהר"}],"correct_choice_id":"a","coins":10}'::jsonb),
  -- Geography g5 - אקלים ויבשות
  ('ffffffff-0000-0000-0000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag":"יבשות","stem":"באיזו יבשת נמצאת ישראל?","hints":["לא אירופה ולא אפריקה","היבשת הגדולה ביותר"],"explanation":"ישראל נמצאת ביבשת אסיה.","choices":[{"id":"a","text":"אסיה"},{"id":"b","text":"אירופה"},{"id":"c","text":"אפריקה"},{"id":"d","text":"אוסטרליה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000003','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אקלים","stem":"מהו המקום הנמוך ביותר ביבשה בעולם?","hints":["בישראל","מים מלוחים מאוד"],"explanation":"ים המלח הוא המקום הנמוך ביותר ביבשה.","choices":[{"id":"a","text":"ים המלח"},{"id":"b","text":"הכנרת"},{"id":"c","text":"האוקיינוס השקט"},{"id":"d","text":"מדבר סהרה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000003','multiple_choice',3,'curated','auto_passed',
   '{"tag":"יבשות","stem":"איזו יבשת קפואה נמצאת בקוטב הדרומי?","hints":["הכי קרה","כמעט אין בה תושבים"],"explanation":"אנטארקטיקה נמצאת בקוטב הדרומי והיא קפואה.","choices":[{"id":"a","text":"אנטארקטיקה"},{"id":"b","text":"אפריקה"},{"id":"c","text":"אירופה"},{"id":"d","text":"אמריקה הדרומית"}],"correct_choice_id":"a","coins":12}'::jsonb),
  -- Future skills g3 - יזמות: המצאות
  ('aaaaaaaa-0000-0000-0000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag":"יזמות","stem":"מה עושים כשרעיון לא עובד בפעם הראשונה?","hints":["לא מוותרים מיד","משנים ומשפרים"],"explanation":"מנסים שוב, לומדים מהטעות ומשפרים את הרעיון.","choices":[{"id":"a","text":"מנסים שוב ומשפרים"},{"id":"b","text":"מוותרים לגמרי"},{"id":"c","text":"מסתירים את הרעיון"},{"id":"d","text":"מאשימים מישהו אחר"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag":"יזמות","stem":"מה עוזר להסביר רעיון חדש לפני שבונים אותו?","hints":["ציור של הרעיון","לא צריך מילים בלבד"],"explanation":"שרטוט או סקיצה עוזרים להראות איך הרעיון ייראה.","choices":[{"id":"a","text":"לצייר שרטוט של הרעיון"},{"id":"b","text":"לשמור אותו בסוד"},{"id":"c","text":"לא לספר לאף אחד"},{"id":"d","text":"לחכות שנה"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000003','multiple_choice',3,'curated','auto_passed',
   '{"tag":"עבודת צוות","stem":"מה חשוב בעבודת צוות על המצאה?","hints":["גם להקשיב וגם לעזור","לא רק לדבר"],"explanation":"בעבודת צוות חשוב להקשיב לאחרים ולעזור.","choices":[{"id":"a","text":"להקשיב ולעזור אחד לשני"},{"id":"b","text":"שכל אחד יעבוד לבד"},{"id":"c","text":"להתווכח כל הזמן"},{"id":"d","text":"שאחד יחליט הכל"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- Future skills g5 - יזמות: מ‑MVP לשוק
  ('ffffffff-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"יזמות","stem":"מה זה קהל יעד?","hints":["מי אמור להשתמש במוצר","לא כולם בעולם"],"explanation":"קהל יעד הוא האנשים שהמוצר מיועד להם.","choices":[{"id":"a","text":"האנשים שהמוצר מיועד להם"},{"id":"b","text":"רק המשפחה של היזם"},{"id":"c","text":"כל אנשי העולם בדיוק"},{"id":"d","text":"המתחרים"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"יזמות","stem":"למה חשוב לקבל משוב מלקוחות?","hints":["כדי לדעת מה לשפר","הם משתמשים במוצר"],"explanation":"משוב מלקוחות עוזר להבין מה עובד ומה כדאי לשפר.","choices":[{"id":"a","text":"כדי לשפר את המוצר"},{"id":"b","text":"כדי להעלות מחיר בלי סיבה"},{"id":"c","text":"זה לא חשוב"},{"id":"d","text":"כדי להעתיק ממתחרים"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('ffffffff-0000-0000-0000-000000000001','multiple_choice',4,'curated','auto_passed',
   '{"tag":"יזמות","stem":"מהי המטרה של \"סיעור מוחות\" (brainstorm)?","hints":["הרבה רעיונות בלי לפסול מיד","כמות לפני איכות"],"explanation":"בסיעור מוחות מעלים כמה שיותר רעיונות בלי לפסול, ואחר כך בוחרים.","choices":[{"id":"a","text":"להעלות הרבה רעיונות בלי לפסול מיד"},{"id":"b","text":"לבחור מיד רעיון אחד"},{"id":"c","text":"לבקר כל רעיון"},{"id":"d","text":"לא לחשוב בכלל"}],"correct_choice_id":"a","coins":13}'::jsonb);

-- Enrichment domains (mirrors enrichment_domains.sql)
alter table curriculum_topics add column if not exists parent_locked boolean not null default false;

insert into curriculum_topics (id, grade, subject, sub_topic, order_index, arabic_variant, parent_locked) values
  ('c1c1c1c1-0000-0000-0000-000000000001', 'enrichment', 'economics', 'כסף וכלכלה', 1, null, false),
  ('c2c2c2c2-0000-0000-0000-000000000001', 'enrichment', 'fashion', 'עולם האופנה', 1, null, false),
  ('c3c3c3c3-0000-0000-0000-000000000001', 'enrichment', 'politics', 'איך מדינה עובדת', 1, null, true),
  ('c4c4c4c4-0000-0000-0000-000000000001', 'enrichment', 'ai', 'בינה מלאכותית', 1, null, true),
  ('c5c5c5c5-0000-0000-0000-000000000001', 'enrichment', 'philosophy', 'שאלות גדולות', 1, null, false)
on conflict (id) do update set sub_topic = excluded.sub_topic, parent_locked = excluded.parent_locked;

insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- Economics
  ('c1c1c1c1-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"כלכלה","stem":"מה זה תקציב?","hints":["תוכנית להוצאות","כמה יש וכמה מוציאים"],"explanation":"תקציב הוא תוכנית שמראה כמה כסף יש וכמה מותר להוציא.","choices":[{"id":"a","text":"תוכנית שמראה כמה כסף יש וכמה מוציאים"},{"id":"b","text":"סוג של מטבע"},{"id":"c","text":"חנות גדולה"},{"id":"d","text":"בנק"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('c1c1c1c1-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"כלכלה","stem":"למה כדאי לחסוך כסף?","hints":["בשביל העתיד","לא להוציא הכל עכשיו"],"explanation":"חוסכים כדי שיהיה כסף לדברים חשובים או לא צפויים בעתיד.","choices":[{"id":"a","text":"כדי שיהיה כסף לדברים חשובים בעתיד"},{"id":"b","text":"כדי לזרוק אותו"},{"id":"c","text":"כי אסור לקנות כלום"},{"id":"d","text":"כדי שאף אחד לא ייקח"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('c1c1c1c1-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"כלכלה","stem":"מה ההבדל בין ''צורך'' ל''רצון''?","hints":["צורך = חייבים; רצון = כיף שיהיה","אוכל מול צעצוע"],"explanation":"צורך הוא משהו שחייבים כדי לחיות (אוכל, בגד); רצון הוא משהו שנחמד אבל אפשר בלעדיו.","choices":[{"id":"a","text":"צורך חייבים כדי לחיות, רצון זה כיף שיהיה"},{"id":"b","text":"אין הבדל"},{"id":"c","text":"צורך יקר יותר תמיד"},{"id":"d","text":"רצון חשוב יותר מצורך"}],"correct_choice_id":"a","coins":13}'::jsonb),
  -- Fashion
  ('c2c2c2c2-0000-0000-0000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag":"אופנה","stem":"מה עושה מעצב/ת אופנה?","hints":["ממציא בגדים","מצייר ומתכנן איך בגד ייראה"],"explanation":"מעצב אופנה מתכנן ומצייר איך בגדים ואביזרים ייראו.","choices":[{"id":"a","text":"מתכנן ומצייר איך בגדים ייראו"},{"id":"b","text":"מוכר אוכל"},{"id":"c","text":"בונה בתים"},{"id":"d","text":"מנקה חנויות"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('c2c2c2c2-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"אופנה","stem":"מאיזה חומר טבעי מייצרים בגדי כותנה?","hints":["גדל בשדה","צמח לבן ורך"],"explanation":"כותנה מיוצרת מצמח הכותנה שגדל בשדה.","choices":[{"id":"a","text":"מצמח הכותנה"},{"id":"b","text":"מפלסטיק"},{"id":"c","text":"ממתכת"},{"id":"d","text":"מזכוכית"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('c2c2c2c2-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אופנה","stem":"מה זה ''אופנה בת‑קיימא'' (אקולוגית)?","hints":["פחות בזבוז","בגדים שמכבדים את הסביבה"],"explanation":"אופנה בת‑קיימא שמה דגש על ייצור שמזיק פחות לסביבה ובגדים שמחזיקים לאורך זמן.","choices":[{"id":"a","text":"בגדים שמייצרים בדרך שמזיקה פחות לסביבה"},{"id":"b","text":"בגדים יקרים מאוד"},{"id":"c","text":"בגדים שזורקים כל יום"},{"id":"d","text":"רק בגדים בצבע ירוק"}],"correct_choice_id":"a","coins":13}'::jsonb),
  -- Politics (sensitive)
  ('c3c3c3c3-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"אזרחות","stem":"מה זה בחירות?","hints":["בוחרים מי יוביל","הצבעה"],"explanation":"בבחירות האזרחים מצביעים כדי לבחור מי ינהיג את המדינה.","choices":[{"id":"a","text":"תהליך שבו אזרחים בוחרים מי ינהיג"},{"id":"b","text":"סוג של חג"},{"id":"c","text":"משחק ספורט"},{"id":"d","text":"חנות"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('c3c3c3c3-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אזרחות","stem":"מה תפקיד החוקים במדינה?","hints":["כללים לכולם","כדי שיהיה הוגן ובטוח"],"explanation":"חוקים הם כללים שעוזרים לחיות יחד בבטחה ובהוגנות.","choices":[{"id":"a","text":"כללים שעוזרים לכולם לחיות יחד בבטחה ובהוגנות"},{"id":"b","text":"רק כדי להעניש"},{"id":"c","text":"רק לילדים"},{"id":"d","text":"אין להם תפקיד"}],"correct_choice_id":"a","coins":13}'::jsonb),
  ('c3c3c3c3-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"אזרחות","stem":"מה זה ''רוב'' בהצבעה?","hints":["הצד עם הכי הרבה קולות","יותר מהחצי"],"explanation":"רוב הוא הצד שקיבל הכי הרבה קולות בהצבעה.","choices":[{"id":"a","text":"הצד שקיבל הכי הרבה קולות"},{"id":"b","text":"הצד עם הכי מעט קולות"},{"id":"c","text":"מי שצועק הכי חזק"},{"id":"d","text":"המבוגר ביותר"}],"correct_choice_id":"a","coins":13}'::jsonb),
  -- AI (sensitive)
  ('c4c4c4c4-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"בינה מלאכותית","stem":"מה זה בינה מלאכותית (AI)?","hints":["מחשב שלומד","תוכנה שיכולה ללמוד ולעזור"],"explanation":"בינה מלאכותית היא תוכנה שיכולה ללמוד מדוגמאות ולבצע משימות כמו לזהות תמונות או לענות על שאלות.","choices":[{"id":"a","text":"תוכנה שיכולה ללמוד ולבצע משימות"},{"id":"b","text":"רובוט מברזל בלבד"},{"id":"c","text":"סוג של טלפון"},{"id":"d","text":"משחק מחשב"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('c4c4c4c4-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"בינה מלאכותית","stem":"האם כדאי להאמין לכל מה ש‑AI אומר?","hints":["גם AI טועה","כדאי לבדוק"],"explanation":"AI יכול לטעות, ולכן חשוב לבדוק מידע חשוב במקורות נוספים.","choices":[{"id":"a","text":"לא - כדאי לבדוק, כי גם AI טועה לפעמים"},{"id":"b","text":"כן, תמיד צודק"},{"id":"c","text":"רק בלילה"},{"id":"d","text":"רק אם הוא ורוד"}],"correct_choice_id":"a","coins":13}'::jsonb),
  ('c4c4c4c4-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"בינה מלאכותית","stem":"מה עוזר ל‑AI ''ללמוד''?","hints":["הרבה דוגמאות","נתונים"],"explanation":"AI לומד מהרבה דוגמאות (נתונים) - כך הוא משתפר במשימה.","choices":[{"id":"a","text":"הרבה דוגמאות ונתונים"},{"id":"b","text":"שינה טובה"},{"id":"c","text":"אוכל בריא"},{"id":"d","text":"מזג אוויר חם"}],"correct_choice_id":"a","coins":13}'::jsonb),
  -- Philosophy
  ('c5c5c5c5-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"פילוסופיה","stem":"מה עושה שאלה ל''שאלה פילוסופית''?","hints":["אין תשובה אחת נכונה","חושבים ומתווכחים עליה"],"explanation":"שאלה פילוסופית היא שאלה גדולה שאין לה תשובה אחת ודאית - חושבים ומתווכחים עליה.","choices":[{"id":"a","text":"שאלה גדולה שאין לה תשובה אחת ודאית"},{"id":"b","text":"שאלה במתמטיקה"},{"id":"c","text":"שאלה על מזג האוויר"},{"id":"d","text":"שאלה עם תשובה אחת ברורה"}],"correct_choice_id":"a","coins":12}'::jsonb),
  ('c5c5c5c5-0000-0000-0000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag":"פילוסופיה","stem":"''עדיף להיות צודק או להיות טוב לב?'' איזו מין שאלה זו?","hints":["אפשר להתווכח","אין תשובה אחת נכונה"],"explanation":"זו שאלה פילוסופית - אין תשובה אחת נכונה, ואפשר לחשוב ולהתווכח עליה.","choices":[{"id":"a","text":"שאלה פילוסופית לחשיבה"},{"id":"b","text":"תרגיל בחשבון"},{"id":"c","text":"שאלה בגאוגרפיה"},{"id":"d","text":"שאלה בדקדוק"}],"correct_choice_id":"a","coins":13}'::jsonb),
  ('c5c5c5c5-0000-0000-0000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"פילוסופיה","stem":"מה זה ''טיעון''?","hints":["הסבר למה חושבים משהו","סיבה לדעה"],"explanation":"טיעון הוא הסבר או סיבה שנותנים כדי לתמוך בדעה.","choices":[{"id":"a","text":"סיבה או הסבר שתומכים בדעה"},{"id":"b","text":"סוג של ריב"},{"id":"c","text":"שם של משחק"},{"id":"d","text":"מספר"}],"correct_choice_id":"a","coins":12}'::jsonb);

-- Seasonal content (mirrors seasonal_content.sql)
insert into curriculum_topics (id, grade, subject, sub_topic, order_index, arabic_variant) values
  ('b0000001-0000-4000-8000-000000000001','enrichment','seasonal','ראש השנה',1,null),
  ('b0000001-0000-4000-8000-000000000002','enrichment','seasonal','סוכות',2,null),
  ('b0000001-0000-4000-8000-000000000003','enrichment','seasonal','חנוכה',3,null),
  ('b0000001-0000-4000-8000-000000000004','enrichment','seasonal','ט״ו בשבט',4,null),
  ('b0000001-0000-4000-8000-000000000005','enrichment','seasonal','פורים',5,null),
  ('b0000001-0000-4000-8000-000000000006','enrichment','seasonal','פסח',6,null),
  ('b0000001-0000-4000-8000-000000000007','enrichment','seasonal','יום העצמאות',7,null),
  ('b0000001-0000-4000-8000-000000000008','enrichment','seasonal','שבועות',8,null),
  ('b0000001-0000-4000-8000-000000000009','enrichment','seasonal','קיץ',9,null)
on conflict (id) do update set sub_topic = excluded.sub_topic;

insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  -- ראש השנה
  ('b0000001-0000-4000-8000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ראש השנה","stem":"מה טובלים בדבש בראש השנה?","hints":["פרי אדום או ירוק","סימן לשנה מתוקה"],"explanation":"טובלים תפוח בדבש כסימן לשנה מתוקה.","choices":[{"id":"a","text":"תפוח"},{"id":"b","text":"בננה"},{"id":"c","text":"מלפפון"},{"id":"d","text":"לחם"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"ראש השנה","stem":"באיזה כלי תוקעים בראש השנה?","hints":["עשוי מקרן של בעל חיים","קול מיוחד"],"explanation":"תוקעים בשופר, שעשוי מקרן.","choices":[{"id":"a","text":"שופר"},{"id":"b","text":"חליל"},{"id":"c","text":"תוף"},{"id":"d","text":"גיטרה"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('b0000001-0000-4000-8000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag":"ראש השנה","stem":"ראש השנה הוא תחילת החודש העברי…","hints":["החודש הראשון בשנה העברית לחגים","מתחיל ב‑ת"],"explanation":"ראש השנה חל בא׳ בתשרי.","choices":[{"id":"a","text":"תשרי"},{"id":"b","text":"ניסן"},{"id":"c","text":"אב"},{"id":"d","text":"אדר"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- סוכות
  ('b0000001-0000-4000-8000-000000000002','multiple_choice',1,'curated','auto_passed',
   '{"tag":"סוכות","stem":"איפה נהוג לשבת ולאכול בחג סוכות?","hints":["מבנה זמני עם סכך","בונים אותה בחצר"],"explanation":"בחג סוכות יושבים בסוכה.","choices":[{"id":"a","text":"בסוכה"},{"id":"b","text":"במרתף"},{"id":"c","text":"בעלייה"},{"id":"d","text":"במוסך"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag":"סוכות","stem":"איזה פרי הוא אחד מארבעת המינים?","hints":["ריחני וצהוב","לא לימון"],"explanation":"האתרוג הוא אחד מארבעת המינים (יחד עם לולב, הדס וערבה).","choices":[{"id":"a","text":"אתרוג"},{"id":"b","text":"תפוז"},{"id":"c","text":"אגס"},{"id":"d","text":"ענב"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('b0000001-0000-4000-8000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag":"סוכות","stem":"ממה עשוי ה''סכך'' שמכסה את הסוכה?","hints":["מהצומח","ענפים ועלים"],"explanation":"הסכך עשוי מצמחייה - ענפים ועלים.","choices":[{"id":"a","text":"ענפים ועלים"},{"id":"b","text":"מתכת"},{"id":"c","text":"זכוכית"},{"id":"d","text":"פלסטיק"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- חנוכה
  ('b0000001-0000-4000-8000-000000000003','multiple_choice',1,'curated','auto_passed',
   '{"tag":"חנוכה","stem":"כמה נרות מדליקים בלילה האחרון של חנוכה (בלי השמש)?","hints":["חנוכה נמשך 8 ימים","מספר הימים"],"explanation":"בלילה השמיני מדליקים 8 נרות (ועוד השמש).","choices":[{"id":"a","text":"שמונה"},{"id":"b","text":"שבעה"},{"id":"c","text":"שישה"},{"id":"d","text":"עשרה"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000003','multiple_choice',1,'curated','auto_passed',
   '{"tag":"חנוכה","stem":"איזה מאכל מטוגן אוכלים בחנוכה?","hints":["מתוק ועגול","עם ריבה בפנים"],"explanation":"בחנוכה נהוג לאכול סופגניות (וגם לביבות).","choices":[{"id":"a","text":"סופגנייה"},{"id":"b","text":"מרק"},{"id":"c","text":"סלט"},{"id":"d","text":"לחם"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag":"חנוכה","stem":"מה מסובבים ומשחקים בו בחנוכה?","hints":["צעצוע מסתובב","עליו אותיות"],"explanation":"משחקים בסביבון עם האותיות נ‑ג‑ה‑פ.","choices":[{"id":"a","text":"סביבון"},{"id":"b","text":"כדור"},{"id":"c","text":"קלף"},{"id":"d","text":"בובה"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- ט"ו בשבט
  ('b0000001-0000-4000-8000-000000000004','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ט״ו בשבט","stem":"ט״ו בשבט נקרא ''ראש השנה ל…''","hints":["קשור לטבע","גדלים בגינה וביער"],"explanation":"ט״ו בשבט הוא ראש השנה לאילנות (לעצים).","choices":[{"id":"a","text":"אילנות (עצים)"},{"id":"b","text":"מכוניות"},{"id":"c","text":"בתים"},{"id":"d","text":"ספרים"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000004','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ט״ו בשבט","stem":"מה נהוג לעשות בט״ו בשבט?","hints":["פעולה טובה לטבע","שמים שתיל באדמה"],"explanation":"נהוג לנטוע עצים בט״ו בשבט.","choices":[{"id":"a","text":"לנטוע עצים"},{"id":"b","text":"לשבור ענפים"},{"id":"c","text":"לזרוק זבל"},{"id":"d","text":"לכבות אורות"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000004','multiple_choice',2,'curated','auto_passed',
   '{"tag":"ט״ו בשבט","stem":"איזה מאכל מיובש נהוג לאכול בט״ו בשבט?","hints":["פרי יבש ומתוק","מגיע מהגפן"],"explanation":"נהוג לאכול פירות יבשים כמו צימוקים (ותאנים).","choices":[{"id":"a","text":"צימוקים"},{"id":"b","text":"שוקולד"},{"id":"c","text":"גלידה"},{"id":"d","text":"צ׳יפס"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- פורים
  ('b0000001-0000-4000-8000-000000000005','multiple_choice',1,'curated','auto_passed',
   '{"tag":"פורים","stem":"איזו מגילה קוראים בפורים?","hints":["שם של מלכה","מתחיל ב‑א"],"explanation":"בפורים קוראים את מגילת אסתר.","choices":[{"id":"a","text":"מגילת אסתר"},{"id":"b","text":"מגילת רות"},{"id":"c","text":"מגילת יונה"},{"id":"d","text":"מגילת דוד"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000005','multiple_choice',1,'curated','auto_passed',
   '{"tag":"פורים","stem":"איזו עוגייה משולשת אוכלים בפורים?","hints":["על שם דמות מהמגילה","צורת משולש"],"explanation":"אוכלים אוזני המן - עוגייה משולשת.","choices":[{"id":"a","text":"אוזני המן"},{"id":"b","text":"סופגנייה"},{"id":"c","text":"מצה"},{"id":"d","text":"בייגלה"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag":"פורים","stem":"מה נהוג לשלוח לחברים בפורים?","hints":["חבילה עם ממתקים ומאכלים","שתי מנות לפחות"],"explanation":"נהוג לשלוח משלוח מנות - מאכלים לחברים.","choices":[{"id":"a","text":"משלוח מנות"},{"id":"b","text":"שיעורי בית"},{"id":"c","text":"אבנים"},{"id":"d","text":"בגדים ישנים"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- פסח
  ('b0000001-0000-4000-8000-000000000006','multiple_choice',1,'curated','auto_passed',
   '{"tag":"פסח","stem":"מה אוכלים בפסח במקום לחם?","hints":["דק ופריך","לא תפח"],"explanation":"בפסח אוכלים מצה במקום לחם.","choices":[{"id":"a","text":"מצה"},{"id":"b","text":"פיתה"},{"id":"c","text":"לחמנייה"},{"id":"d","text":"בורקס"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000006','multiple_choice',2,'curated','auto_passed',
   '{"tag":"פסח","stem":"איך נקראת הארוחה החגיגית בליל פסח?","hints":["קוראים בה הגדה","סדר מסוים"],"explanation":"ארוחת ליל פסח נקראת ''הסדר''.","choices":[{"id":"a","text":"הסדר"},{"id":"b","text":"הקידוש"},{"id":"c","text":"הבדלה"},{"id":"d","text":"הסעודה השלישית"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('b0000001-0000-4000-8000-000000000006','multiple_choice',2,'curated','auto_passed',
   '{"tag":"פסח","stem":"פסח מזכיר את יציאת בני ישראל מ…","hints":["ארץ בדרום","עם פירמידות"],"explanation":"פסח מזכיר את יציאת מצרים.","choices":[{"id":"a","text":"מצרים"},{"id":"b","text":"בבל"},{"id":"c","text":"יוון"},{"id":"d","text":"רומא"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- יום העצמאות
  ('b0000001-0000-4000-8000-000000000007','multiple_choice',1,'curated','auto_passed',
   '{"tag":"יום העצמאות","stem":"מה חוגגים ביום העצמאות?","hints":["הקמת המדינה","1948"],"explanation":"ביום העצמאות חוגגים את הקמת מדינת ישראל.","choices":[{"id":"a","text":"הקמת מדינת ישראל"},{"id":"b","text":"תחילת הקיץ"},{"id":"c","text":"יום הולדת של המורה"},{"id":"d","text":"סוף שנת הלימודים"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000007','multiple_choice',1,'curated','auto_passed',
   '{"tag":"יום העצמאות","stem":"מה הם צבעי דגל ישראל?","hints":["כמו הטלית","שני צבעים"],"explanation":"דגל ישראל כחול ולבן, עם מגן דוד.","choices":[{"id":"a","text":"כחול ולבן"},{"id":"b","text":"אדום וירוק"},{"id":"c","text":"שחור וצהוב"},{"id":"d","text":"סגול וכתום"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000007','multiple_choice',2,'curated','auto_passed',
   '{"tag":"יום העצמאות","stem":"מה נהוג לראות בשמיים ביום העצמאות?","hints":["חיל האוויר","טסים ביחד"],"explanation":"נהוג לצפות במטס של מטוסי חיל האוויר.","choices":[{"id":"a","text":"מטס מטוסים"},{"id":"b","text":"שלג"},{"id":"c","text":"עלים נושרים"},{"id":"d","text":"ברקים"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- שבועות
  ('b0000001-0000-4000-8000-000000000008','multiple_choice',1,'curated','auto_passed',
   '{"tag":"שבועות","stem":"מה מציין חג שבועות?","hints":["קרה בהר סיני","קיבלנו אותה"],"explanation":"שבועות מציין את מתן תורה (קבלת התורה).","choices":[{"id":"a","text":"קבלת התורה"},{"id":"b","text":"בניית הפירמידות"},{"id":"c","text":"גילוי אמריקה"},{"id":"d","text":"המצאת הגלגל"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000008','multiple_choice',1,'curated','auto_passed',
   '{"tag":"שבועות","stem":"אילו מאכלים נהוג לאכול בשבועות?","hints":["מהחלב","גבינות ועוגות גבינה"],"explanation":"בשבועות נהוג לאכול מאכלי חלב, כמו גבינות ובלינצ׳ס.","choices":[{"id":"a","text":"מאכלי חלב"},{"id":"b","text":"בשר בלבד"},{"id":"c","text":"רק פירות יבשים"},{"id":"d","text":"רק מרק"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000008','multiple_choice',2,'curated','auto_passed',
   '{"tag":"שבועות","stem":"שבועות הוא גם חג של…","hints":["בחקלאות","אוספים את היבול"],"explanation":"שבועות הוא חג הקציר והביכורים.","choices":[{"id":"a","text":"קציר וביכורים"},{"id":"b","text":"שלג"},{"id":"c","text":"דיג"},{"id":"d","text":"ציד"}],"correct_choice_id":"a","coins":11}'::jsonb),
  -- קיץ
  ('b0000001-0000-4000-8000-000000000009','multiple_choice',1,'curated','auto_passed',
   '{"tag":"קיץ","stem":"מה מומלץ למרוח על העור לפני שיוצאים לשמש בקיץ?","hints":["מגן מכוויות שמש","קרם מיוחד"],"explanation":"מורחים קרם הגנה כדי להגן על העור מהשמש.","choices":[{"id":"a","text":"קרם הגנה"},{"id":"b","text":"קטשופ"},{"id":"c","text":"דבק"},{"id":"d","text":"צבע"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000009','multiple_choice',1,'curated','auto_passed',
   '{"tag":"קיץ","stem":"איזה פרי קיץ עסיסי ואדום מבפנים אוכלים בחום?","hints":["גדול וירוק מבחוץ","עם גרעינים שחורים"],"explanation":"אבטיח הוא פרי קיץ עסיסי, ירוק מבחוץ ואדום מבפנים.","choices":[{"id":"a","text":"אבטיח"},{"id":"b","text":"תפוח"},{"id":"c","text":"בננה"},{"id":"d","text":"אגוז"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000009','multiple_choice',2,'curated','auto_passed',
   '{"tag":"קיץ","stem":"למה חשוב לשתות הרבה מים בקיץ?","hints":["חם ומזיעים","הגוף מאבד נוזלים"],"explanation":"בקיץ מזיעים ומאבדים נוזלים, ולכן חשוב לשתות הרבה מים.","choices":[{"id":"a","text":"כי מזיעים ומאבדים נוזלים"},{"id":"b","text":"כי המים מתוקים"},{"id":"c","text":"כדי לגדול מהר"},{"id":"d","text":"אין סיבה"}],"correct_choice_id":"a","coins":11}'::jsonb);


-- Depth sub-topics (extra sub-topic per core subject) - added for variety.
insert into curriculum_topics (id, grade, subject, sub_topic, order_index, arabic_variant) values
  ('d1000000-0000-4000-8000-000000000001','grade_3','math','חיבור וחיסור',2,null),
  ('d1000000-0000-4000-8000-000000000002','grade_3','geometry','מדידות ואורך',2,null),
  ('d1000000-0000-4000-8000-000000000003','grade_3','hebrew','הפכים ומילים נרדפות',2,null),
  ('d1000000-0000-4000-8000-000000000004','grade_3','science','מזג אוויר ועונות',2,null),
  ('d1000000-0000-4000-8000-000000000005','grade_3','english','צבעים ומספרים',2,null),
  ('d1000000-0000-4000-8000-000000000006','grade_3','bible','נוח והמבול',2,null),
  ('d1000000-0000-4000-8000-000000000007','grade_3','geography','מפה וכיוונים',2,null),
  ('d1000000-0000-4000-8000-000000000008','grade_3','arabic','מספרים 1-10',2,null),
  ('d2000000-0000-4000-8000-000000000001','grade_5','math','אחוזים ועשרוני',2,null),
  ('d2000000-0000-4000-8000-000000000002','grade_5','geometry','זוויות ומשולשים',2,null),
  ('d2000000-0000-4000-8000-000000000003','grade_5','hebrew','שורש ומשפחת מילים',2,null),
  ('d2000000-0000-4000-8000-000000000004','grade_5','science','מערכת השמש',2,null),
  ('d2000000-0000-4000-8000-000000000005','grade_5','english','הווה ועבר',2,null),
  ('d2000000-0000-4000-8000-000000000006','grade_5','bible','מלכי ישראל',2,null),
  ('d2000000-0000-4000-8000-000000000007','grade_5','geography','יבשות ובירות',2,null),
  ('d2000000-0000-4000-8000-000000000008','grade_5','arabic','משפחה ובית',2,null)
on conflict (id) do update set sub_topic = excluded.sub_topic, grade = excluded.grade;

insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  ('d1000000-0000-4000-8000-000000000001','multiple_choice',1,'curated','auto_passed',
   '{"tag": "חיבור", "stem": "כמה זה 45 + 30 ?", "hints": ["נוסיף עשרות", "40+30 ואז +5"], "explanation": "45+30=75.", "choices": [{"id": "a", "text": "75"}, {"id": "b", "text": "70"}, {"id": "c", "text": "85"}, {"id": "d", "text": "65"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag": "חיסור", "stem": "כמה זה 82 − 17 ?", "hints": ["נוריד 10 ואז 7", "82−10=72, ואז −7"], "explanation": "82−17=65.", "choices": [{"id": "a", "text": "65"}, {"id": "b", "text": "75"}, {"id": "c", "text": "69"}, {"id": "d", "text": "55"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag": "חיבור", "stem": "לרוני 26 מדבקות וקיבלה עוד 19. כמה יש לה?", "hints": ["26+19", "כמעט 26+20"], "explanation": "26+19=45.", "choices": [{"id": "a", "text": "45"}, {"id": "b", "text": "44"}, {"id": "c", "text": "46"}, {"id": "d", "text": "35"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000002','multiple_choice',1,'curated','auto_passed',
   '{"tag": "אורך", "stem": "כמה סנטימטרים יש במטר אחד?", "hints": ["מטר = 100 ...", "מספר עגול"], "explanation": "במטר יש 100 סנטימטרים.", "choices": [{"id": "a", "text": "100"}, {"id": "b", "text": "10"}, {"id": "c", "text": "1000"}, {"id": "d", "text": "50"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag": "היקף", "stem": "מה ההיקף של ריבוע שכל צלע בו 5 ס״מ?", "hints": ["מחברים את כל הצלעות", "5+5+5+5"], "explanation": "היקף ריבוע = 4×5 = 20 ס״מ.", "choices": [{"id": "a", "text": "20 ס״מ"}, {"id": "b", "text": "25 ס״מ"}, {"id": "c", "text": "10 ס״מ"}, {"id": "d", "text": "15 ס״מ"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag": "אורך", "stem": "במה כדאי למדוד את אורך העיפרון?", "hints": ["יחידה קטנה", "לא קילומטרים"], "explanation": "עיפרון מודדים בסנטימטרים.", "choices": [{"id": "a", "text": "סנטימטרים"}, {"id": "b", "text": "קילומטרים"}, {"id": "c", "text": "ליטרים"}, {"id": "d", "text": "קילוגרמים"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000003','multiple_choice',1,'curated','auto_passed',
   '{"tag": "הפכים", "stem": "מה ההפך מ״יום״?", "hints": ["כשחשוך", "אחרי הערב"], "explanation": "ההפך מיום הוא לילה.", "choices": [{"id": "a", "text": "לילה"}, {"id": "b", "text": "בוקר"}, {"id": "c", "text": "שמש"}, {"id": "d", "text": "אור"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000003','multiple_choice',1,'curated','auto_passed',
   '{"tag": "נרדפות", "stem": "איזו מילה דומה במשמעות ל״רץ״?", "hints": ["תנועה מהירה", "לא הולך לאט"], "explanation": "״דוהר״ דומה ל״רץ״.", "choices": [{"id": "a", "text": "דוהר"}, {"id": "b", "text": "ישן"}, {"id": "c", "text": "יושב"}, {"id": "d", "text": "אוכל"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag": "הפכים", "stem": "מה ההפך מ״מלא״?", "hints": ["כשאין כלום בפנים", "כוס בלי מים"], "explanation": "ההפך ממלא הוא ריק.", "choices": [{"id": "a", "text": "ריק"}, {"id": "b", "text": "כבד"}, {"id": "c", "text": "גדול"}, {"id": "d", "text": "רחב"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000004','multiple_choice',1,'curated','auto_passed',
   '{"tag": "עונות", "stem": "באיזו עונה יורד שלג במקומות קרים?", "hints": ["העונה הקרה", "אחרי הסתיו"], "explanation": "בחורף קר ולפעמים יורד שלג.", "choices": [{"id": "a", "text": "חורף"}, {"id": "b", "text": "קיץ"}, {"id": "c", "text": "אביב"}, {"id": "d", "text": "סתיו"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000004','multiple_choice',1,'curated','auto_passed',
   '{"tag": "מזג אוויר", "stem": "מה רואים בשמיים אחרי גשם עם שמש?", "hints": ["בשבעה צבעים", "קשת"], "explanation": "אחרי גשם ושמש מופיעה קשת בענן.", "choices": [{"id": "a", "text": "קשת"}, {"id": "b", "text": "שלג"}, {"id": "c", "text": "ברד"}, {"id": "d", "text": "כוכבים"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000004','multiple_choice',2,'curated','auto_passed',
   '{"tag": "עונות", "stem": "באיזו עונה נושרים העלים מהעצים?", "hints": ["בין קיץ לחורף", "הכל מצהיב"], "explanation": "בסתיו העלים נושרים.", "choices": [{"id": "a", "text": "סתיו"}, {"id": "b", "text": "אביב"}, {"id": "c", "text": "קיץ"}, {"id": "d", "text": "חורף"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000005','multiple_choice',1,'curated','auto_passed',
   '{"tag": "צבעים", "stem": "מה זה \"red\" בעברית?", "hints": ["צבע של תפוח", "גם של עגבנייה"], "explanation": "\"red\" זה אדום.", "choices": [{"id": "a", "text": "אדום"}, {"id": "b", "text": "כחול"}, {"id": "c", "text": "ירוק"}, {"id": "d", "text": "צהוב"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000005','multiple_choice',1,'curated','auto_passed',
   '{"tag": "מספרים", "stem": "מה זה \"three\" בעברית?", "hints": ["מספר", "אחרי two"], "explanation": "\"three\" זה שלוש.", "choices": [{"id": "a", "text": "שלוש"}, {"id": "b", "text": "שתיים"}, {"id": "c", "text": "חמש"}, {"id": "d", "text": "ארבע"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag": "צבעים", "stem": "מה זה \"blue\" בעברית?", "hints": ["צבע השמיים", "צבע הים"], "explanation": "\"blue\" זה כחול.", "choices": [{"id": "a", "text": "כחול"}, {"id": "b", "text": "שחור"}, {"id": "c", "text": "לבן"}, {"id": "d", "text": "ורוד"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000006','multiple_choice',1,'curated','auto_passed',
   '{"tag": "נוח", "stem": "מה בנה נוח לפי הסיפור?", "hints": ["כלי שט גדול", "בשביל החיות"], "explanation": "נוח בנה תיבה.", "choices": [{"id": "a", "text": "תיבה"}, {"id": "b", "text": "מגדל"}, {"id": "c", "text": "גשר"}, {"id": "d", "text": "ארמון"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000006','multiple_choice',1,'curated','auto_passed',
   '{"tag": "נוח", "stem": "כמה מכל מין בעלי חיים נכנסו לתיבה (זכר ונקבה)?", "hints": ["זוג", "זכר ונקבה"], "explanation": "מכל מין נכנסו שניים - זכר ונקבה.", "choices": [{"id": "a", "text": "שניים"}, {"id": "b", "text": "אחד"}, {"id": "c", "text": "עשרה"}, {"id": "d", "text": "שבעה"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000006','multiple_choice',2,'curated','auto_passed',
   '{"tag": "נוח", "stem": "איזו ציפור שלח נוח לבדוק אם ירדו המים?", "hints": ["מביאה עלה זית", "ציפור שלום"], "explanation": "נוח שלח יונה, שחזרה עם עלה זית.", "choices": [{"id": "a", "text": "יונה"}, {"id": "b", "text": "נשר"}, {"id": "c", "text": "תרנגול"}, {"id": "d", "text": "ברווז"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000007','multiple_choice',1,'curated','auto_passed',
   '{"tag": "כיוונים", "stem": "מאיזה כיוון זורחת השמש?", "hints": ["שם מתחיל היום", "ההפך ממערב"], "explanation": "השמש זורחת במזרח.", "choices": [{"id": "a", "text": "מזרח"}, {"id": "b", "text": "מערב"}, {"id": "c", "text": "צפון"}, {"id": "d", "text": "דרום"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000007','multiple_choice',2,'curated','auto_passed',
   '{"tag": "מפה", "stem": "מה מראה צבע כחול ברוב המפות?", "hints": ["שם יש מים", "ים ואגמים"], "explanation": "כחול במפה מסמן מים - ים, נהר ואגם.", "choices": [{"id": "a", "text": "מים"}, {"id": "b", "text": "הרים"}, {"id": "c", "text": "ערים"}, {"id": "d", "text": "יערות"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000007','multiple_choice',2,'curated','auto_passed',
   '{"tag": "כיוונים", "stem": "איזה כלי עוזר למצוא כיוון (צפון)?", "hints": ["מחט שמצביעה", "לא שעון"], "explanation": "מצפן מראה את הכיוונים.", "choices": [{"id": "a", "text": "מצפן"}, {"id": "b", "text": "סרגל"}, {"id": "c", "text": "משקל"}, {"id": "d", "text": "שעון חול"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d1000000-0000-4000-8000-000000000008','multiple_choice',1,'curated','auto_passed',
   '{"tag": "מספרים", "stem": "איך אומרים ״אחד״ בערבית מדוברת?", "hints": ["המספר הראשון", "מתחיל ב־וו"], "explanation": "״אחד״ בערבית - וַאחֶד.", "choices": [{"id": "a", "text": "וַאחֶד"}, {"id": "b", "text": "תְנֵין"}, {"id": "c", "text": "תַלַאתֶה"}, {"id": "d", "text": "עַשַרַה"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000008','multiple_choice',1,'curated','auto_passed',
   '{"tag": "מספרים", "stem": "איך אומרים ״שתיים״ בערבית מדוברת?", "hints": ["אחרי וַאחֶד", "מתחיל ב־ת"], "explanation": "״שתיים״ בערבית - תְנֵין.", "choices": [{"id": "a", "text": "תְנֵין"}, {"id": "b", "text": "וַאחֶד"}, {"id": "c", "text": "אַרְבַּעַה"}, {"id": "d", "text": "חַמְסֶה"}], "correct_choice_id": "a", "coins": 10}'::jsonb),
  ('d1000000-0000-4000-8000-000000000008','multiple_choice',2,'curated','auto_passed',
   '{"tag": "מספרים", "stem": "איך אומרים ״שלוש״ בערבית מדוברת?", "hints": ["אחרי תְנֵין", "מתחיל ב־ת"], "explanation": "״שלוש״ בערבית - תַלַאתֶה.", "choices": [{"id": "a", "text": "תַלַאתֶה"}, {"id": "b", "text": "תְנֵין"}, {"id": "c", "text": "סַבְעַה"}, {"id": "d", "text": "עַשַרַה"}], "correct_choice_id": "a", "coins": 11}'::jsonb),
  ('d2000000-0000-4000-8000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag": "אחוזים", "stem": "כמה זה 50% מתוך 80?", "hints": ["חצי", "80 חלקי 2"], "explanation": "50% זה חצי, ולכן 40.", "choices": [{"id": "a", "text": "40"}, {"id": "b", "text": "50"}, {"id": "c", "text": "30"}, {"id": "d", "text": "8"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000001','multiple_choice',2,'curated','auto_passed',
   '{"tag": "עשרוני", "stem": "מה גדול יותר: 0.7 או 0.65 ?", "hints": ["משווים עשיריות", "0.70 מול 0.65"], "explanation": "0.7 = 0.70, שגדול מ־0.65.", "choices": [{"id": "a", "text": "0.7"}, {"id": "b", "text": "0.65"}, {"id": "c", "text": "הם שווים"}, {"id": "d", "text": "אי אפשר לדעת"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000001','multiple_choice',3,'curated','auto_passed',
   '{"tag": "אחוזים", "stem": "חנות נותנת 10% הנחה על חולצה ב־200 ₪. כמה ההנחה?", "hints": ["10% = חלקי 10", "200 חלקי 10"], "explanation": "10% מ־200 זה 20 ₪.", "choices": [{"id": "a", "text": "20 ₪"}, {"id": "b", "text": "10 ₪"}, {"id": "c", "text": "2 ₪"}, {"id": "d", "text": "40 ₪"}], "correct_choice_id": "a", "coins": 13}'::jsonb),
  ('d2000000-0000-4000-8000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag": "זוויות", "stem": "כמה מעלות יש בזווית ישרה?", "hints": ["פינה של ריבוע", "רבע סיבוב"], "explanation": "זווית ישרה = 90 מעלות.", "choices": [{"id": "a", "text": "90"}, {"id": "b", "text": "180"}, {"id": "c", "text": "45"}, {"id": "d", "text": "360"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000002','multiple_choice',3,'curated','auto_passed',
   '{"tag": "משולש", "stem": "כמה מעלות סכום הזוויות בכל משולש?", "hints": ["תמיד אותו דבר", "חצי סיבוב"], "explanation": "סכום הזוויות במשולש הוא 180 מעלות.", "choices": [{"id": "a", "text": "180"}, {"id": "b", "text": "90"}, {"id": "c", "text": "360"}, {"id": "d", "text": "270"}], "correct_choice_id": "a", "coins": 13}'::jsonb),
  ('d2000000-0000-4000-8000-000000000002','multiple_choice',2,'curated','auto_passed',
   '{"tag": "משולש", "stem": "איך נקרא משולש שכל צלעותיו שוות?", "hints": ["שלוש צלעות שוות", "גם הזוויות שוות"], "explanation": "משולש עם שלוש צלעות שוות הוא שווה־צלעות.", "choices": [{"id": "a", "text": "שווה־צלעות"}, {"id": "b", "text": "ישר־זווית"}, {"id": "c", "text": "שונה־צלעות"}, {"id": "d", "text": "קהה־זווית"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag": "שורש", "stem": "מה השורש המשותף למילים ״כתב, מכתב, כתובת״?", "hints": ["שלוש אותיות", "קשור לכתיבה"], "explanation": "השורש הוא כ־ת־ב.", "choices": [{"id": "a", "text": "כ־ת־ב"}, {"id": "b", "text": "מ־כ־ת"}, {"id": "c", "text": "כ־ב־ת"}, {"id": "d", "text": "ת־ב־כ"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000003','multiple_choice',2,'curated','auto_passed',
   '{"tag": "משפחת מילים", "stem": "איזו מילה שייכת למשפחת ״ספר״?", "hints": ["אותו שורש", "מקום עם ספרים"], "explanation": "״ספרייה״ מאותה משפחה של ״ספר״.", "choices": [{"id": "a", "text": "ספרייה"}, {"id": "b", "text": "שולחן"}, {"id": "c", "text": "חלון"}, {"id": "d", "text": "מכונית"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000003','multiple_choice',3,'curated','auto_passed',
   '{"tag": "שורש", "stem": "מה השורש של המילה ״שמירה״?", "hints": ["קשור לשמור", "שלוש אותיות"], "explanation": "השורש הוא ש־מ־ר.", "choices": [{"id": "a", "text": "ש־מ־ר"}, {"id": "b", "text": "ש־מ־ה"}, {"id": "c", "text": "מ־ר־ה"}, {"id": "d", "text": "ש־ר־ה"}], "correct_choice_id": "a", "coins": 13}'::jsonb),
  ('d2000000-0000-4000-8000-000000000004','multiple_choice',2,'curated','auto_passed',
   '{"tag": "חלל", "stem": "איזה כוכב לכת הקרוב ביותר לשמש?", "hints": ["הכי חם וקרוב", "מתחיל ב־ח"], "explanation": "חמה (מרקורי) הוא הקרוב ביותר לשמש.", "choices": [{"id": "a", "text": "חמה"}, {"id": "b", "text": "נוגה"}, {"id": "c", "text": "מאדים"}, {"id": "d", "text": "צדק"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000004','multiple_choice',2,'curated','auto_passed',
   '{"tag": "חלל", "stem": "מה מקיף כדור הארץ ומאיר בלילה?", "hints": ["לוויין טבעי", "משתנה בצורתו"], "explanation": "הירח מקיף את כדור הארץ.", "choices": [{"id": "a", "text": "הירח"}, {"id": "b", "text": "השמש"}, {"id": "c", "text": "מאדים"}, {"id": "d", "text": "השביט"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000004','multiple_choice',3,'curated','auto_passed',
   '{"tag": "חלל", "stem": "כמה כוכבי לכת יש במערכת השמש?", "hints": ["אחרי שהורידו את פלוטו", "מספר זוגי"], "explanation": "במערכת השמש 8 כוכבי לכת.", "choices": [{"id": "a", "text": "שמונה"}, {"id": "b", "text": "תשעה"}, {"id": "c", "text": "שבעה"}, {"id": "d", "text": "עשרה"}], "correct_choice_id": "a", "coins": 13}'::jsonb),
  ('d2000000-0000-4000-8000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag": "עבר", "stem": "מה צורת העבר של \"go\"?", "hints": ["פועל חריג", "לא \"goed\""], "explanation": "העבר של \"go\" הוא \"went\".", "choices": [{"id": "a", "text": "went"}, {"id": "b", "text": "goed"}, {"id": "c", "text": "gone"}, {"id": "d", "text": "going"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000005','multiple_choice',2,'curated','auto_passed',
   '{"tag": "הווה", "stem": "איך אומרים \"אני אוכל\" (הווה) באנגלית?", "hints": ["I + פועל", "לא עבר"], "explanation": "\"אני אוכל\" - \"I eat\".", "choices": [{"id": "a", "text": "I eat"}, {"id": "b", "text": "I ate"}, {"id": "c", "text": "I eaten"}, {"id": "d", "text": "I eating"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000005','multiple_choice',3,'curated','auto_passed',
   '{"tag": "עבר", "stem": "מה צורת העבר של \"have\"?", "hints": ["פועל חריג", "מתחיל ב־h"], "explanation": "העבר של \"have\" הוא \"had\".", "choices": [{"id": "a", "text": "had"}, {"id": "b", "text": "haved"}, {"id": "c", "text": "haz"}, {"id": "d", "text": "having"}], "correct_choice_id": "a", "coins": 13}'::jsonb),
  ('d2000000-0000-4000-8000-000000000006','multiple_choice',2,'curated','auto_passed',
   '{"tag": "מלכים", "stem": "מי היה המלך הראשון של ישראל?", "hints": ["משח אותו שמואל", "מתחיל ב־ש"], "explanation": "שאול היה המלך הראשון.", "choices": [{"id": "a", "text": "שאול"}, {"id": "b", "text": "דוד"}, {"id": "c", "text": "שלמה"}, {"id": "d", "text": "אחאב"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000006','multiple_choice',2,'curated','auto_passed',
   '{"tag": "מלכים", "stem": "מי בנה את בית המקדש הראשון בירושלים?", "hints": ["בנו של דוד", "חכם מאוד"], "explanation": "שלמה המלך בנה את בית המקדש.", "choices": [{"id": "a", "text": "שלמה"}, {"id": "b", "text": "שאול"}, {"id": "c", "text": "דוד"}, {"id": "d", "text": "ירבעם"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000006','multiple_choice',3,'curated','auto_passed',
   '{"tag": "מלכים", "stem": "את מי ניצח דוד בקרב לפי הסיפור?", "hints": ["ענק פלישתי", "עם קלע ואבן"], "explanation": "דוד ניצח את גוליית.", "choices": [{"id": "a", "text": "גוליית"}, {"id": "b", "text": "פרעה"}, {"id": "c", "text": "המן"}, {"id": "d", "text": "נבוכדנצר"}], "correct_choice_id": "a", "coins": 13}'::jsonb),
  ('d2000000-0000-4000-8000-000000000007','multiple_choice',2,'curated','auto_passed',
   '{"tag": "יבשות", "stem": "כמה יבשות יש בעולם?", "hints": ["מספר קבוע", "בין 6 ל־8"], "explanation": "בעולם 7 יבשות.", "choices": [{"id": "a", "text": "שבע"}, {"id": "b", "text": "חמש"}, {"id": "c", "text": "עשר"}, {"id": "d", "text": "שלוש"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000007','multiple_choice',2,'curated','auto_passed',
   '{"tag": "בירות", "stem": "מהי בירת צרפת?", "hints": ["עיר האורות", "עם מגדל אייפל"], "explanation": "בירת צרפת היא פריז.", "choices": [{"id": "a", "text": "פריז"}, {"id": "b", "text": "לונדון"}, {"id": "c", "text": "רומא"}, {"id": "d", "text": "מדריד"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000007','multiple_choice',3,'curated','auto_passed',
   '{"tag": "יבשות", "stem": "באיזו יבשת נמצאת ישראל?", "hints": ["בין אירופה לאפריקה", "היבשת הגדולה"], "explanation": "ישראל נמצאת ביבשת אסיה.", "choices": [{"id": "a", "text": "אסיה"}, {"id": "b", "text": "אירופה"}, {"id": "c", "text": "אפריקה"}, {"id": "d", "text": "אמריקה"}], "correct_choice_id": "a", "coins": 13}'::jsonb),
  ('d2000000-0000-4000-8000-000000000008','multiple_choice',2,'curated','auto_passed',
   '{"tag": "משפחה", "stem": "איך אומרים ״אמא״ בערבית ספרותית?", "hints": ["מילה קצרה", "דומה לעברית"], "explanation": "״אמא״ בערבית - אֻם.", "choices": [{"id": "a", "text": "אֻם"}, {"id": "b", "text": "אַבּ"}, {"id": "c", "text": "אֶחְת"}, {"id": "d", "text": "אַח"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000008','multiple_choice',2,'curated','auto_passed',
   '{"tag": "משפחה", "stem": "איך אומרים ״אבא״ בערבית ספרותית?", "hints": ["מילה קצרה", "מתחיל ב־א"], "explanation": "״אבא״ בערבית - אַבּ.", "choices": [{"id": "a", "text": "אַבּ"}, {"id": "b", "text": "אֻם"}, {"id": "c", "text": "אַח"}, {"id": "d", "text": "בֵּית"}], "correct_choice_id": "a", "coins": 12}'::jsonb),
  ('d2000000-0000-4000-8000-000000000008','multiple_choice',3,'curated','auto_passed',
   '{"tag": "בית", "stem": "מה הפירוש של המילה ״בֵּית״ בערבית?", "hints": ["גם בעברית דומה", "גרים בו"], "explanation": "״בֵּית״ בערבית פירושו בית.", "choices": [{"id": "a", "text": "בית"}, {"id": "b", "text": "דלת"}, {"id": "c", "text": "חלון"}, {"id": "d", "text": "גינה"}], "correct_choice_id": "a", "coins": 13}'::jsonb);


-- New question types (true/false + fill-in).
-- Curated true_false + type_in questions (new question types).
-- Safe to re-run: clears prior curated rows of these types for these topics.
delete from questions_bank
 where source = 'curated' and type in ('true_false','type_in')
   and topic_id in (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000002',
  'cccccccc-0000-0000-0000-000000000003',
  'cccccccc-0000-0000-0000-000000000004',
  'cccccccc-0000-0000-0000-000000000005',
  'dddddddd-0000-0000-0000-000000000001',
  'dddddddd-0000-0000-0000-000000000002',
  'dddddddd-0000-0000-0000-000000000003',
  'dddddddd-0000-0000-0000-000000000005'
);

insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload) values
  ('aaaaaaaa-0000-0000-0000-000000000001','type_in',1,'curated','auto_passed',
   '{"tag": "כפל", "stem": "כמה זה 8 × 3?", "answers": ["24"], "hints": ["ספרי בקפיצות של 8", "8, 16, 24"], "explanation": "8×3=24."}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000001','true_false',1,'curated','auto_passed',
   '{"tag": "כפל", "stem": "6 × 7 שווה 42.", "answer": true, "hints": ["ספרי בקפיצות של 7", "שש קפיצות"], "explanation": "נכון - 6×7=42."}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000001','type_in',2,'curated','auto_passed',
   '{"tag": "כפל", "stem": "כמה זה 9 × 4?", "answers": ["36"], "hints": ["9, 18, 27…", "ארבע קפיצות של 9"], "explanation": "9×4=36."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000001','type_in',1,'curated','auto_passed',
   '{"tag": "צורות", "stem": "לכמה צלעות יש משולש?", "answers": ["3", "שלוש"], "hints": ["בשם רמז", "מְשׁוּלָּשׁ"], "explanation": "למשולש 3 צלעות."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000001','true_false',1,'curated','auto_passed',
   '{"tag": "צורות", "stem": "לריבוע יש ארבע צלעות באותו אורך.", "answer": true, "hints": ["ריבוע…", "כל הצלעות שוות"], "explanation": "נכון."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000002','true_false',1,'curated','auto_passed',
   '{"tag": "נרדפות", "stem": "המילים \"שמח\" ו\"עצוב\" הן מילים נרדפות.", "answer": false, "hints": ["אותה משמעות?", "הפוכות"], "explanation": "לא - הן הפכים, לא נרדפות."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000002','type_in',1,'curated','auto_passed',
   '{"tag": "הפכים", "stem": "מה ההפך מהמילה \"גדול\"?", "answers": ["קטן"], "hints": ["משהו זעיר", "ההפך מגדול"], "explanation": "ההפך מגדול הוא קטן."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000005','true_false',1,'curated','auto_passed',
   '{"tag": "בעלי חיים", "stem": "דג נושם דרך ריאות כמו בני אדם.", "answer": false, "hints": ["איפה חי הדג?", "זימים"], "explanation": "לא - דג נושם דרך זימים."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000005','type_in',2,'curated','auto_passed',
   '{"tag": "בעלי חיים", "stem": "כמה רגליים יש לחרק?", "answers": ["6", "שש"], "hints": ["לא ארבע", "מספר זוגי"], "explanation": "לחרק 6 רגליים."}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000001','type_in',1,'curated','auto_passed',
   '{"tag": "אנגלית", "stem": "איך אומרים \"כלב\" באנגלית?", "answers": ["dog"], "hints": ["חיה נובחת", "מתחיל ב-d"], "explanation": "\"כלב\" = dog."}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000001','true_false',1,'curated','auto_passed',
   '{"tag": "אנגלית", "stem": "המילה \"cat\" באנגלית פירושה חתול.", "answer": true, "hints": ["חיה שאומרת מיאו", "נכון?"], "explanation": "נכון - cat = חתול."}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000003','true_false',1,'curated','auto_passed',
   '{"tag": "בראשית", "stem": "נוח בנה תיבה לפי הסיפור.", "answer": true, "hints": ["כלי שט גדול", "בשביל החיות"], "explanation": "נכון - נוח בנה תיבה."}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000005','true_false',1,'curated','auto_passed',
   '{"tag": "ארץ ישראל", "stem": "ירושלים היא בירת ישראל.", "answer": true, "hints": ["עיר הבירה", "נכון?"], "explanation": "נכון."}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001','type_in',2,'curated','auto_passed',
   '{"tag": "שברים", "stem": "כמה זה 1/2 + 1/2? (כמספר שלם)", "answers": ["1", "אחד"], "hints": ["שני חצאים", "שלם"], "explanation": "חצי ועוד חצי = 1."}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001','true_false',2,'curated','auto_passed',
   '{"tag": "שברים", "stem": "השבר 1/3 גדול יותר מ-1/2.", "answer": false, "hints": ["חשבי על פיצה", "יותר חתיכות = קטנות"], "explanation": "לא - 1/2 גדול מ-1/3."}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001','type_in',3,'curated','auto_passed',
   '{"tag": "אחוזים", "stem": "כמה זה 25% מתוך 100?", "answers": ["25"], "hints": ["רבע", "100 חלקי 4"], "explanation": "25% מ-100 זה 25."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003','type_in',2,'curated','auto_passed',
   '{"tag": "שטח", "stem": "מה השטח של ריבוע שצלעו 5 ס״מ? (מספר בלבד)", "answers": ["25"], "hints": ["צלע כפול צלע", "5×5"], "explanation": "שטח = 5×5 = 25."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003','true_false',2,'curated','auto_passed',
   '{"tag": "זוויות", "stem": "בזווית ישרה יש 90 מעלות.", "answer": true, "hints": ["פינת ריבוע", "רבע סיבוב"], "explanation": "נכון - זווית ישרה = 90°."}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000004','true_false',2,'curated','auto_passed',
   '{"tag": "עובדה ודעה", "stem": "המשפט \"גלידה היא הקינוח הכי טעים\" הוא עובדה.", "answer": false, "hints": ["אפשר להתווכח?", "טעם אישי"], "explanation": "לא - זו דעה, לא עובדה."}'::jsonb),
  ('dddddddd-0000-0000-0000-000000000002','type_in',2,'curated','auto_passed',
   '{"tag": "אנגלית", "stem": "מה צורת הרבים של \"child\"?", "answers": ["children"], "hints": ["לא childs", "צורה חריגה"], "explanation": "הרבים של child הוא children."}'::jsonb);
