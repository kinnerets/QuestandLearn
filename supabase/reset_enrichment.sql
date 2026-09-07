-- Regenerate the enrichment subjects' AI content so it comes back WITH nikud
-- (readable for Mili, grade 3) and under the stronger spelling check. Deletes
-- only AI-generated questions on enrichment-grade topics; keeps core subjects
-- and any curated content. The generator refills them automatically (on-demand
-- while playing + nightly). Run once when you want the cleanup now.
delete from questions_bank
where source = 'ai_generated'
  and topic_id in (select id from curriculum_topics where grade = 'enrichment');
