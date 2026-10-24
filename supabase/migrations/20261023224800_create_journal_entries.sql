-- Journal entries owned by the signed-in Supabase user.
-- This file is not applied by the awarely.ai app. Run it once in the Supabase SQL Editor.

begin;

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  mood text,
  custom_feeling text,
  journal_text text not null,
  photo_path text,
  constraint journal_entries_mood_check check (
    mood is null
    or mood in ('calm', 'grateful', 'tender', 'heavy', 'restless', 'hopeful', 'unsure')
  ),
  constraint journal_entries_custom_feeling_check check (
    custom_feeling is null
    or char_length(custom_feeling) between 1 and 60
  ),
  constraint journal_entries_journal_text_check check (
    char_length(journal_text) between 1 and 2000
  ),
  constraint journal_entries_photo_path_check check (
    photo_path is null
    or (
      char_length(photo_path) between 1 and 1024
      and photo_path !~* '^data:'
    )
  )
);

comment on table public.journal_entries is
  'Private journal rows. photo_path is a storage path, not image bytes.';

create index journal_entries_user_created_at_idx
  on public.journal_entries (user_id, created_at desc);

revoke all on table public.journal_entries from public;
revoke all on table public.journal_entries from anon;
grant select, insert, update, delete on table public.journal_entries to authenticated;

alter table public.journal_entries enable row level security;
alter table public.journal_entries force row level security;

create policy journal_entries_select_own
  on public.journal_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy journal_entries_insert_own
  on public.journal_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy journal_entries_update_own
  on public.journal_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy journal_entries_delete_own
  on public.journal_entries
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_journal_entry_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'journal entries require a signed-in user';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from old.user_id then
    raise exception 'journal entry owner cannot be changed';
  end if;

  return new;
end;
$$;

create trigger journal_entries_set_owner
  before insert or update on public.journal_entries
  for each row
  execute function public.set_journal_entry_owner();

commit;
