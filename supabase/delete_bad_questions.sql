-- Remove two questions that were approved by mistake.
--
-- STEP 1 - PREVIEW: run this first and check it lists ONLY the questions you want
-- gone (an English "saw" question, and a rectangle-perimeter question with 10 and 6).
select id, payload->>'stem' as stem, source
from questions_bank
where payload->>'stem' ilike '%saw%'
   or (payload->>'stem' like '%היקף%' and payload->>'stem' like '%מלבן%'
       and payload->>'stem' like '%10%' and payload->>'stem' like '%6%');

-- STEP 2 - DELETE: once the preview shows only what you want removed, run this.
-- (The child's practice history is preserved - question_id just becomes null now.)
delete from questions_bank
where payload->>'stem' ilike '%saw%'
   or (payload->>'stem' like '%היקף%' and payload->>'stem' like '%מלבן%'
       and payload->>'stem' like '%10%' and payload->>'stem' like '%6%');

-- If the preview showed extra questions you do NOT want to delete, skip STEP 2 and
-- instead delete only the exact ones by id, e.g.:
--   delete from questions_bank where id in ('<id-from-preview>', '<id-from-preview>');
