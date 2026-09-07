-- Remove duplicate questions that share the same wording within a topic (they
-- caused a child to see "the same question" again). Conservative: only deletes a
-- duplicate that has NO recorded attempts, so nothing a child already answered is
-- lost. Keeps one row per (topic, normalized stem). Safe to run anytime.
delete from questions_bank a
using questions_bank b
where a.topic_id = b.topic_id
  and a.payload->>'stem' is not null
  and lower(regexp_replace(trim(a.payload->>'stem'), '\s+', ' ', 'g'))
    = lower(regexp_replace(trim(b.payload->>'stem'), '\s+', ' ', 'g'))
  and a.ctid > b.ctid
  and not exists (select 1 from attempts_log al where al.question_id = a.id);
