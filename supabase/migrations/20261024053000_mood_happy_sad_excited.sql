-- Allow Happy, Sad, and Excited on journal entries.
-- Safe to run more than once. Does not change existing rows.
-- Not applied by the app. Paste this file into the Supabase SQL Editor if the journal table already exists.

begin;

alter table public.journal_entries drop constraint if exists journal_entries_mood_check;
alter table public.journal_entries
  add constraint journal_entries_mood_check check (
    mood is null
    or mood in ('happy', 'sad', 'excited', 'calm', 'grateful', 'tender', 'heavy', 'restless', 'hopeful', 'unsure')
  );

commit;
