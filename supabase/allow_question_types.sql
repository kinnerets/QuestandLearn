-- Allow the varied question types the generator now produces (multiple_choice,
-- multi_select, true_false, type_in) by removing any CHECK constraint that pins
-- questions_bank.type to a fixed set. The app validates the type in code, so the
-- DB constraint is unnecessary and would otherwise block multi_select inserts.
-- Run once; safe to re-run.
alter table questions_bank drop constraint if exists questions_bank_type_check;
