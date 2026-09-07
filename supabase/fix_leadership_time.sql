-- Reword the "הזמן שלי" leadership mission: "מטבעות זמן" (time coins) was
-- confusing because coins are the app's reward currency. Use "חלקים של זמן".
-- Run once; safe to re-run.
update questions_bank
set payload = jsonb_set(payload, '{prompt}', '"יש לך היום 5 חלקים של זמן פנוי. איך תחלקי אותם?"')
where topic_id = 'eeeeeeee-0000-0000-0000-000000000002'
  and payload->>'prompt' like '%מטבעות זמן%';
