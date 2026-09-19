-- Yom Kippur seasonal topic + gentle, age-appropriate questions (ages 8-11).
-- Surfaced automatically around the 10th of Tishri by the Hebrew-calendar logic
-- in lib/db.ts. Safe to run once (idempotent on the topic id).
insert into curriculum_topics (id, grade, subject, sub_topic, order_index, arabic_variant) values
  ('b0000001-0000-4000-8000-000000000010','enrichment','seasonal','יום כיפור',10,null)
on conflict (id) do update set sub_topic = excluded.sub_topic;

-- Only seed the questions if they aren't already there, so re-running won't duplicate.
insert into questions_bank (topic_id, type, difficulty, source, verification_status, payload)
select v.topic_id, v.type, v.difficulty, v.source, v.status, v.payload
from (values
  ('b0000001-0000-4000-8000-000000000010','multiple_choice',1,'curated','auto_passed',
   '{"tag":"יום כיפור","stem":"יום כיפור הוא יום שבו נהוג לבקש מהאנשים סביבנו…","hints":["כשעושים משהו לא נעים לחבר","מילה קטנה שמשלימה בין אנשים"],"explanation":"ביום כיפור נהוג לבקש סליחה ולהשלים עם אנשים.","choices":[{"id":"a","text":"סליחה"},{"id":"b","text":"כסף"},{"id":"c","text":"מתנות"},{"id":"d","text":"שיעורי בית"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000010','multiple_choice',1,'curated','auto_passed',
   '{"tag":"יום כיפור","stem":"איזה צבע בגד נהוג ללבוש ביום כיפור?","hints":["צבע בהיר מאוד","הצבע של ענן או שלג"],"explanation":"נהוג ללבוש לבן ביום כיפור, כסמל לניקיון ולהתחלה חדשה.","choices":[{"id":"a","text":"לבן"},{"id":"b","text":"שחור"},{"id":"c","text":"אדום"},{"id":"d","text":"סגול"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000010','multiple_choice',2,'curated','auto_passed',
   '{"tag":"יום כיפור","stem":"יום כיפור חל בחודש העברי…","hints":["אותו חודש של ראש השנה וסוכות","מתחיל באות ת"],"explanation":"יום כיפור חל בעשירי בתשרי, אותו חודש של ראש השנה.","choices":[{"id":"a","text":"תשרי"},{"id":"b","text":"ניסן"},{"id":"c","text":"אב"},{"id":"d","text":"אדר"}],"correct_choice_id":"a","coins":11}'::jsonb),
  ('b0000001-0000-4000-8000-000000000010','multiple_choice',1,'curated','auto_passed',
   '{"tag":"יום כיפור","stem":"בישראל ביום כיפור הכבישים ריקים מכלי רכב. מה נהוג לילדים רבים לעשות בהם?","hints":["דורש קסדה","יש לו שני גלגלים ודוושות"],"explanation":"ביום כיפור הכבישים שקטים, וילדים רבים רוכבים על אופניים.","choices":[{"id":"a","text":"לרכוב על אופניים"},{"id":"b","text":"לנהוג במכונית"},{"id":"c","text":"להדליק זיקוקים"},{"id":"d","text":"לשחק כדורגל בכביש המהיר"}],"correct_choice_id":"a","coins":10}'::jsonb),
  ('b0000001-0000-4000-8000-000000000010','multiple_choice',2,'curated','auto_passed',
   '{"tag":"יום כיפור","stem":"במה שונה יום כיפור משאר ימות השנה אצל מבוגרים רבים?","hints":["קשור לאוכל","יום מיוחד ושקט"],"explanation":"מבוגרים רבים צמים ביום כיפור - לא אוכלים ולא שותים במשך היום.","choices":[{"id":"a","text":"רבים צמים - לא אוכלים ולא שותים"},{"id":"b","text":"אוכלים כל היום ממתקים"},{"id":"c","text":"הולכים לעבודה כרגיל"},{"id":"d","text":"נוסעים לטיול ארוך ברכב"}],"correct_choice_id":"a","coins":11}'::jsonb)
) as v(topic_id, type, difficulty, source, status, payload)
where not exists (
  select 1 from questions_bank q where q.topic_id = 'b0000001-0000-4000-8000-000000000010'
);
