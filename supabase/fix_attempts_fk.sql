-- Preserve a child's practice history when a question is deleted.
--
-- attempts_log.question_id used to be `references questions_bank(id) on delete
-- cascade`, so deleting a question (a reset, the nightly dedup/purge, or a
-- revalidation) also deleted every attempt the child had made on it. That
-- silently changed her accuracy with no new practice (accuracy is answered vs
-- correct from attempts_log), e.g. dropping from 100% to 91% overnight.
--
-- An attempt records topic_id + is_correct, which is all accuracy needs. The
-- question it referred to may be long gone. So we keep the attempt and just let
-- its question_id go null when the question is deleted.
--
-- Safe to run more than once.
alter table attempts_log alter column question_id drop not null;

alter table attempts_log drop constraint if exists attempts_log_question_id_fkey;

alter table attempts_log
  add constraint attempts_log_question_id_fkey
  foreign key (question_id) references questions_bank(id) on delete set null;
