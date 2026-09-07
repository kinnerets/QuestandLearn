-- Optional: regenerate geometry and gifted AI questions so they come back WITH
-- the new illustrations (SVG shapes / reasoning shape rows). Deletes only the
-- AI-generated questions on those subjects; the generator refills them
-- automatically (on-demand while playing + nightly), now including diagrams.
delete from questions_bank
where source = 'ai_generated'
  and topic_id in (select id from curriculum_topics where subject in ('geometry', 'gifted'));
