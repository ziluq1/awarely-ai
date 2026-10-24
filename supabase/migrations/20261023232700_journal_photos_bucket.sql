-- Private photo bucket for journal entries.
-- Not applied by the app. Run this in the Supabase SQL Editor after
-- 20261023224800_create_journal_entries.sql.

insert into storage.buckets (id, name, public)
values ('journal-photos', 'journal-photos', false)
on conflict (id) do update set public = false;

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
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy journal_photos_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy journal_photos_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy journal_photos_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
