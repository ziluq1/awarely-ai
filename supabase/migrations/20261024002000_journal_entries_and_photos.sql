-- awarely.ai account timeline.
-- Safe to run more than once. Does not drop the table, delete rows, rewrite rows, or remove stored photos.
-- Not applied by the app. Paste this whole file into the Supabase SQL Editor and run it there.
--
-- Matches lib/account-journal.ts:
--   table public.journal_entries
--   columns id, user_id, created_at, mood, custom_feeling, journal_text, photo_path
--   mood values happy, sad, excited, calm, grateful, tender, heavy, restless, hopeful, unsure, or null
--   private bucket journal-photos
--   object path {user uuid}/{entry uuid}-{unix milliseconds}.jpg
--
-- user_id, created_at, and journal_text are NOT NULL on a new table.
-- If existing rows already contain nulls, those columns are left unchanged and a notice is raised.

begin;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  mood text,
  custom_feeling text,
  journal_text text not null,
  photo_path text
);

alter table public.journal_entries add column if not exists id uuid default gen_random_uuid();
alter table public.journal_entries add column if not exists user_id uuid;
alter table public.journal_entries add column if not exists created_at timestamptz;
alter table public.journal_entries add column if not exists mood text;
alter table public.journal_entries add column if not exists custom_feeling text;
alter table public.journal_entries add column if not exists journal_text text;
alter table public.journal_entries add column if not exists photo_path text;

alter table public.journal_entries alter column id set default gen_random_uuid();
alter table public.journal_entries alter column created_at set default now();

do $$
begin
  if not exists (select 1 from public.journal_entries where user_id is null) then
    alter table public.journal_entries alter column user_id set not null;
  else
    raise notice 'Left user_id nullable because existing rows have null user_id. No rows were changed.';
  end if;

  if not exists (select 1 from public.journal_entries where created_at is null) then
    alter table public.journal_entries alter column created_at set not null;
  else
    raise notice 'Left created_at nullable because existing rows have null created_at. No rows were changed.';
  end if;

  if not exists (select 1 from public.journal_entries where journal_text is null) then
    alter table public.journal_entries alter column journal_text set not null;
  else
    raise notice 'Left journal_text nullable because existing rows have null journal_text. No rows were changed.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entries_pkey'
      and conrelid = 'public.journal_entries'::regclass
  ) then
    if not exists (
      select 1
      from public.journal_entries
      where id is null
         or id in (select id from public.journal_entries group by id having count(*) > 1)
    ) then
      alter table public.journal_entries add constraint journal_entries_pkey primary key (id);
    else
      raise notice 'Left journal_entries without a new primary key because existing ids are missing or duplicated. No rows were changed.';
    end if;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entries_user_id_fkey'
      and conrelid = 'public.journal_entries'::regclass
  )
  and not exists (
    select 1
    from public.journal_entries as entry
    where entry.user_id is not null
      and not exists (select 1 from auth.users as account where account.id = entry.user_id)
  ) then
    alter table public.journal_entries
      add constraint journal_entries_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  elsif not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entries_user_id_fkey'
      and conrelid = 'public.journal_entries'::regclass
  ) then
    raise notice 'Left the user_id foreign key uncreated because some existing user_id values are not in auth.users. No rows were changed.';
  end if;

  if not exists (
    select 1
    from public.journal_entries
    where mood is not null
      and mood not in ('happy', 'sad', 'excited', 'calm', 'grateful', 'tender', 'heavy', 'restless', 'hopeful', 'unsure')
  ) then
    alter table public.journal_entries drop constraint if exists journal_entries_mood_check;
    alter table public.journal_entries
      add constraint journal_entries_mood_check check (
        mood is null
        or mood in ('happy', 'sad', 'excited', 'calm', 'grateful', 'tender', 'heavy', 'restless', 'hopeful', 'unsure')
      );
  else
    raise notice 'Left the mood check unchanged because existing mood values are outside the app list. No rows were changed.';
  end if;

  if not exists (
    select 1
    from public.journal_entries
    where custom_feeling is not null
      and char_length(custom_feeling) not between 1 and 60
  ) then
    alter table public.journal_entries drop constraint if exists journal_entries_custom_feeling_check;
    alter table public.journal_entries
      add constraint journal_entries_custom_feeling_check check (
        custom_feeling is null
        or char_length(custom_feeling) between 1 and 60
      );
  else
    raise notice 'Left the custom_feeling check unchanged because existing values are outside 1 to 60 characters. No rows were changed.';
  end if;

  if not exists (
    select 1
    from public.journal_entries
    where journal_text is not null
      and char_length(journal_text) not between 1 and 2000
  ) then
    alter table public.journal_entries drop constraint if exists journal_entries_journal_text_check;
    alter table public.journal_entries
      add constraint journal_entries_journal_text_check check (
        char_length(journal_text) between 1 and 2000
      );
  else
    raise notice 'Left the journal_text length check unchanged because existing text is outside 1 to 2000 characters. No rows were changed.';
  end if;

  if not exists (
    select 1
    from public.journal_entries
    where photo_path is not null
      and (
        user_id is null
        or split_part(photo_path, '/', 1) is distinct from user_id::text
        or photo_path !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+\.jpg$'
      )
  ) then
    alter table public.journal_entries drop constraint if exists journal_entries_photo_path_check;
    alter table public.journal_entries
      add constraint journal_entries_photo_path_check check (
        photo_path is null
        or (
          split_part(photo_path, '/', 1) = user_id::text
          and photo_path ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+\.jpg$'
        )
      );
  else
    raise notice 'Left the photo_path check unchanged because existing paths do not match the app path format. No rows were changed.';
  end if;
end
$$;

comment on table public.journal_entries is
  'Private journal rows. photo_path is a journal-photos object path, not image bytes.';

create index if not exists journal_entries_user_created_at_idx
  on public.journal_entries (user_id, created_at desc);

revoke all on table public.journal_entries from public;
revoke all on table public.journal_entries from anon;
grant select, insert, update, delete on table public.journal_entries to authenticated;

alter table public.journal_entries enable row level security;
alter table public.journal_entries force row level security;

drop policy if exists journal_entries_select_own on public.journal_entries;
drop policy if exists journal_entries_insert_own on public.journal_entries;
drop policy if exists journal_entries_update_own on public.journal_entries;
drop policy if exists journal_entries_delete_own on public.journal_entries;

create policy journal_entries_select_own
  on public.journal_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy journal_entries_insert_own
  on public.journal_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy journal_entries_update_own
  on public.journal_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy journal_entries_delete_own
  on public.journal_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

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

revoke all on function public.set_journal_entry_owner() from public;
revoke all on function public.set_journal_entry_owner() from anon;
grant execute on function public.set_journal_entry_owner() to authenticated;

drop trigger if exists journal_entries_set_owner on public.journal_entries;
create trigger journal_entries_set_owner
  before insert or update on public.journal_entries
  for each row
  execute function public.set_journal_entry_owner();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-photos', 'journal-photos', false, 5000000, array['image/jpeg'])
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists journal_photos_read_own on storage.objects;
drop policy if exists journal_photos_insert_own on storage.objects;
drop policy if exists journal_photos_update_own on storage.objects;
drop policy if exists journal_photos_delete_own on storage.objects;

create policy journal_photos_read_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and name ~ (
      '^' || (select auth.uid()::text) ||
      '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+\.jpg$'
    )
  );

create policy journal_photos_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'journal-photos'
    and name ~ (
      '^' || (select auth.uid()::text) ||
      '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+\.jpg$'
    )
  );

create policy journal_photos_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and name ~ (
      '^' || (select auth.uid()::text) ||
      '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+\.jpg$'
    )
  )
  with check (
    bucket_id = 'journal-photos'
    and name ~ (
      '^' || (select auth.uid()::text) ||
      '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+\.jpg$'
    )
  );

create policy journal_photos_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and name ~ (
      '^' || (select auth.uid()::text) ||
      '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]+\.jpg$'
    )
  );

commit;
