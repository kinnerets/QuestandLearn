-- More seasonal / civil-day content, surfaced automatically by date (see lib/db.ts).
-- Not Jewish holidays: Halloween, Sylvester, World Space Week, a health day, plus
-- Tu B'Av. Age-appropriate (8-11). Safe to run more than once (idempotent per topic).

insert into curriculum_topics (id, grade, subject, sub_topic, order_index, arabic_variant) values
  ('b0000001-0000-4000-8000-000000000011','enrichment','seasonal','ט״ו באב',11,null),
  ('b0000001-0000-4000-8000-000000000012','enrichment','seasonal','האלווין',12,null),
  ('b0000001-0000-4000-8000-000000000013','enrichment','seasonal','סילבסטר',13,null),
  ('b0000001-0000-4000-8000-000000000014','enrichment','seasonal','שבוע החלל',14,null),
  ('b0000001-0000-4000-8000-000000000015','enrichment','seasonal','אני והגוף שלי',15,null)
on conflict (id) do update set sub_topic = excluded.sub_topic;

-- ט״ו באב
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload)
select v.topic_id::uuid, v.type, v.difficulty, v.source, v.status, v.payload
from (values
  ('b0000001-0000-4000-8000-000000000011','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ט״ו באב","stem":"ט״ו באב ידוע בעיקר כיום של…","hints":["קשור לרגש טוב בין אנשים","יום שמח בקיץ"],"explanation":"ט״ו באב הוא יום של אהבה, חברות וקרבה בין אנשים.","choices":[{"id":"a","text":"אהבה וחברות"},{"id":"b","text":"מבחנים"},{"id":"c","text":"ניקיון הבית"},{"id":"d","text":"צום"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000011','multiple_choice',1,'curated','auto_passed',
   '{"tag":"ט״ו באב","stem":"באיזו עונה חל ט״ו באב?","hints":["חם מאוד בחוץ","באמצע חודש אב"],"explanation":"ט״ו באב חל בקיץ, באמצע חודש אב.","choices":[{"id":"a","text":"קיץ"},{"id":"b","text":"חורף"},{"id":"c","text":"סתיו"},{"id":"d","text":"אביב"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000011','multiple_choice',2,'curated','auto_passed',
   '{"tag":"ט״ו באב","stem":"מה נחמד לעשות בט״ו באב?","hints":["משהו טוב לאנשים שאוהבים","קשור למילים טובות"],"explanation":"בט״ו באב נחמד לומר מילים טובות ולהראות אהבה למשפחה ולחברים.","choices":[{"id":"a","text":"לומר מילים טובות לחברים ולמשפחה"},{"id":"b","text":"לריב עם כולם"},{"id":"c","text":"להתעצל כל היום"},{"id":"d","text":"לשבור צעצועים"}],"correct_choice_id":"a","coins":11}'::jsonb)
) as v(topic_id, type, difficulty, source, status, payload)
where not exists (select 1 from questions_bank q where q.topic_id = 'b0000001-0000-4000-8000-000000000011');

-- האלווין (לא חג יהודי, אבל חוגגים בארץ)
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload)
select v.topic_id::uuid, v.type, v.difficulty, v.source, v.status, v.payload
from (values
  ('b0000001-0000-4000-8000-000000000012','multiple_choice',2,'curated','auto_passed',
   '{"tag":"האלווין","stem":"חג האלווין הגיע במקור…","hints":["לא מופיע בתורה","חוגגים אותו בהרבה מדינות בעולם"],"explanation":"האלווין אינו חג יהודי. הוא הגיע ממדינות אחרות בעולם, ובישראל חלק מהילדים אוהבים לחגוג אותו בכיף.","choices":[{"id":"a","text":"ממדינות אחרות בעולם"},{"id":"b","text":"מהתורה"},{"id":"c","text":"מראש השנה"},{"id":"d","text":"מחג הפסח"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('b0000001-0000-4000-8000-000000000012','multiple_choice',1,'curated','auto_passed',
   '{"tag":"האלווין","stem":"איזה ירק כתום מגלפים ומקשטים באלווין?","hints":["ירק כתום וגדול","מכינים ממנו גם מרק"],"explanation":"באלווין נהוג לגלף דלעת ולקשט בה.","choices":[{"id":"a","text":"דלעת"},{"id":"b","text":"מלפפון"},{"id":"c","text":"תפוח"},{"id":"d","text":"בצל"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000012','multiple_choice',1,'curated','auto_passed',
   '{"tag":"האלווין","stem":"מה ילדים נוהגים לעשות באלווין?","hints":["לובשים משהו מיוחד","מבקשים דבר מתוק"],"explanation":"באלווין נהוג להתחפש ולבקש ממתקים.","choices":[{"id":"a","text":"מתחפשים ומבקשים ממתקים"},{"id":"b","text":"הולכים לישון מוקדם"},{"id":"c","text":"עושים מבחן"},{"id":"d","text":"מנקים את החצר"}],"correct_choice_id":"a","coins":10}'::jsonb)
) as v(topic_id, type, difficulty, source, status, payload)
where not exists (select 1 from questions_bank q where q.topic_id = 'b0000001-0000-4000-8000-000000000012');

-- סילבסטר
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload)
select v.topic_id::uuid, v.type, v.difficulty, v.source, v.status, v.payload
from (values
  ('b0000001-0000-4000-8000-000000000013','multiple_choice',2,'curated','auto_passed',
   '{"tag":"סילבסטר","stem":"סילבסטר הוא הלילה שבו מתחילה…","hints":["קשור ללוח השנה של רוב העולם","הלילה בין 31 בדצמבר ל-1 בינואר"],"explanation":"סילבסטר הוא הלילה שבו מתחילה השנה הלועזית (הגרגוריאנית), שונה מראש השנה העברי.","choices":[{"id":"a","text":"השנה הלועזית"},{"id":"b","text":"שנת הלימודים"},{"id":"c","text":"עונת הקיץ"},{"id":"d","text":"החופש הגדול"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('b0000001-0000-4000-8000-000000000013','multiple_choice',1,'curated','auto_passed',
   '{"tag":"סילבסטר","stem":"באיזה חודש חל סילבסטר?","hints":["החודש האחרון בשנה הלועזית","אחרי נובמבר"],"explanation":"סילבסטר חל בסוף דצמבר, בלילה שבין 31 בדצמבר ל-1 בינואר.","choices":[{"id":"a","text":"דצמבר"},{"id":"b","text":"מרץ"},{"id":"c","text":"יולי"},{"id":"d","text":"ספטמבר"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000013','multiple_choice',2,'curated','auto_passed',
   '{"tag":"סילבסטר","stem":"במה שונה סילבסטר מראש השנה העברי?","hints":["שני לוחות שנה שונים","אחד עברי ואחד לועזי"],"explanation":"סילבסטר הוא תחילת השנה בלוח הלועזי, וראש השנה הוא תחילת השנה בלוח העברי.","choices":[{"id":"a","text":"סילבסטר הוא בלוח הלועזי וראש השנה בלוח העברי"},{"id":"b","text":"אין שום הבדל ביניהם"},{"id":"c","text":"שניהם חלים באותו יום בדיוק"},{"id":"d","text":"שניהם חגים דתיים יהודיים"}],"correct_choice_id":"a","coins":11}'::jsonb)
) as v(topic_id, type, difficulty, source, status, payload)
where not exists (select 1 from questions_bank q where q.topic_id = 'b0000001-0000-4000-8000-000000000013');

-- שבוע החלל
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload)
select v.topic_id::uuid, v.type, v.difficulty, v.source, v.status, v.payload
from (values
  ('b0000001-0000-4000-8000-000000000014','multiple_choice',1,'curated','auto_passed',
   '{"tag":"שבוע החלל","stem":"מהו הכוכב הגדול והחם שכדור הארץ מקיף?","hints":["מאיר ומחמם ביום","צהוב וגדול בשמיים"],"explanation":"כדור הארץ מקיף את השמש, שהיא כוכב.","choices":[{"id":"a","text":"השמש"},{"id":"b","text":"הירח"},{"id":"c","text":"מאדים"},{"id":"d","text":"כוכב הצפון"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000014','multiple_choice',2,'curated','auto_passed',
   '{"tag":"שבוע החלל","stem":"כמה כוכבי לכת יש במערכת השמש?","hints":["יותר משבעה","פחות מתשעה"],"explanation":"במערכת השמש יש שמונה כוכבי לכת, וכדור הארץ אחד מהם.","choices":[{"id":"a","text":"שמונה"},{"id":"b","text":"שלושה"},{"id":"c","text":"מאה"},{"id":"d","text":"אחד"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('b0000001-0000-4000-8000-000000000014','multiple_choice',1,'curated','auto_passed',
   '{"tag":"שבוע החלל","stem":"מה מקיף את כדור הארץ ומאיר בלילה?","hints":["מתחלף בצורתו במהלך החודש","רואים אותו בשמי הלילה"],"explanation":"הירח מקיף את כדור הארץ ומאיר בלילה.","choices":[{"id":"a","text":"הירח"},{"id":"b","text":"השמש"},{"id":"c","text":"עננים"},{"id":"d","text":"מטוס"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000014','multiple_choice',1,'curated','auto_passed',
   '{"tag":"שבוע החלל","stem":"מה לובש אסטרונאוט כשהוא יוצא לחלל?","hints":["בגד מיוחד עם חמצן","מגן עליו בחלל"],"explanation":"בחלל אין אוויר לנשימה, ולכן אסטרונאוט לובש חליפת חלל.","choices":[{"id":"a","text":"חליפת חלל"},{"id":"b","text":"בגד ים"},{"id":"c","text":"פיג׳מה"},{"id":"d","text":"מעיל גשם"}],"correct_choice_id":"a","coins":10}'::jsonb)
) as v(topic_id, type, difficulty, source, status, payload)
where not exists (select 1 from questions_bank q where q.topic_id = 'b0000001-0000-4000-8000-000000000014');

-- אני והגוף שלי (יום בריאות)
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload)
select v.topic_id::uuid, v.type, v.difficulty, v.source, v.status, v.payload
from (values
  ('b0000001-0000-4000-8000-000000000015','multiple_choice',1,'curated','auto_passed',
   '{"tag":"אני והגוף שלי","stem":"כמה פעמים ביום מומלץ לצחצח שיניים?","hints":["בבוקר ובערב","יותר מאחת"],"explanation":"מומלץ לצחצח שיניים פעמיים ביום, בבוקר ולפני השינה.","choices":[{"id":"a","text":"פעמיים"},{"id":"b","text":"פעם בשבוע"},{"id":"c","text":"אף פעם"},{"id":"d","text":"פעם בחודש"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000015','multiple_choice',1,'curated','auto_passed',
   '{"tag":"אני והגוף שלי","stem":"מתי חשוב במיוחד לשטוף ידיים?","hints":["קשור לאוכל ולשירותים","כדי לא להעביר חיידקים"],"explanation":"חשוב לשטוף ידיים לפני האוכל ואחרי השירותים, כדי לשמור על הבריאות.","choices":[{"id":"a","text":"לפני האוכל ואחרי השירותים"},{"id":"b","text":"רק ביום הולדת"},{"id":"c","text":"אף פעם לא צריך"},{"id":"d","text":"רק כשמתלכלכים בצבע"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000015','multiple_choice',2,'curated','auto_passed',
   '{"tag":"אני והגוף שלי","stem":"מה עוזר לגוף להישאר בריא וחזק?","hints":["לזוז ולנוח","גם מה שאוכלים חשוב"],"explanation":"תנועה, אוכל בריא ושינה טובה עוזרים לגוף להיות בריא וחזק.","choices":[{"id":"a","text":"תנועה, אוכל בריא ושינה טובה"},{"id":"b","text":"לשבת כל היום מול מסך"},{"id":"c","text":"לאכול רק ממתקים"},{"id":"d","text":"לא לישון בכלל"}],"correct_choice_id":"a","coins":11}'::jsonb)
) as v(topic_id, type, difficulty, source, status, payload)
where not exists (select 1 from questions_bank q where q.topic_id = 'b0000001-0000-4000-8000-000000000015');
