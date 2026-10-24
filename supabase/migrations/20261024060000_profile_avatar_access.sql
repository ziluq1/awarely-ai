-- Profile photo access for awarely.ai.
-- Safe to run more than once. Does not delete profiles, photos, or journal rows.
-- Run supabase/migrations/20261024040000_friends_and_shared_timelines.sql first.
-- Not applied by the app. Paste this file into the Supabase SQL Editor.

begin;

create or replace function public.social_can_read_avatar(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.avatar_path = object_name
      and p.avatar_path = lower(p.id::text) || '/avatar.jpg'
      and (
        p.id = (select auth.uid())
        or exists (
          select 1 from public.blocks b
          where b.blocker_id = (select auth.uid())
            and b.blocked_id = p.id
        )
        or exists (
          select 1 from public.friendships f
          where f.status in ('pending', 'accepted')
            and (
              (f.requester_id = (select auth.uid()) and f.addressee_id = p.id)
              or (f.addressee_id = (select auth.uid()) and f.requester_id = p.id)
            )
        )
        or public.social_shares_timeline(p.id)
        or (
          p.searchable
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
               or (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
          )
        )
      )
  );
$$;

revoke all on function public.social_can_read_avatar(text) from public, anon;
grant execute on function public.social_can_read_avatar(text) to authenticated;

create or replace function public.set_my_avatar(next_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  cleaned text := nullif(pg_catalog.btrim(coalesce(next_path, '')), '');
  person public.profiles;
begin
  me := public.social_me();
  if cleaned is not null and lower(cleaned) <> lower(me::text) || '/avatar.jpg' then
    raise exception 'That profile photo could not be saved.';
  end if;
  cleaned := lower(cleaned);

  update public.profiles
  set avatar_path = cleaned
  where id = me
  returning * into person;

  return public.profile_json(person);
end;
$$;

drop policy if exists profile_avatars_select_visible on storage.objects;
drop policy if exists profile_avatars_insert_own on storage.objects;
drop policy if exists profile_avatars_update_own on storage.objects;
drop policy if exists profile_avatars_delete_own on storage.objects;

create policy profile_avatars_select_visible
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and public.social_can_read_avatar(name)
  );

create policy profile_avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and lower(name) = lower((select auth.uid())::text) || '/avatar.jpg'
  );

create policy profile_avatars_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and lower(name) = lower((select auth.uid())::text) || '/avatar.jpg'
  )
  with check (
    bucket_id = 'profile-avatars'
    and lower(name) = lower((select auth.uid())::text) || '/avatar.jpg'
  );

create policy profile_avatars_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and lower(name) = lower((select auth.uid())::text) || '/avatar.jpg'
  );

commit;
