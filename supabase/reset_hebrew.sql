-- Regenerate Hebrew AI questions so they come back with a real learning goal
-- (inference, vocabulary-in-context, main idea) instead of trivial
-- answer-in-the-question items. Deletes only AI-generated Hebrew questions; the
-- generator refills them automatically (on-demand while playing + nightly).
delete from questions_bank
where source = 'ai_generated'
  and topic_id in (select id from curriculum_topics where subject = 'hebrew');
