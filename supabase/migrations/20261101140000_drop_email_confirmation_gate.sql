-- Stop requiring a confirmed email for account data.
-- Safe to run more than once. Does not delete users, profiles, journal rows, or photos.
-- Not applied by the app. Paste this file into the Supabase SQL Editor.
-- Also turn off Confirm email under Authentication → Providers → Email.

begin;

create or replace function public.email_is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

revoke all on function public.email_is_verified() from public, anon;
grant execute on function public.email_is_verified() to authenticated;

create or replace function public.social_me()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  user_email text;
  user_meta jsonb;
begin
  if me is null then
    raise exception 'Log in to continue.';
  end if;

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
  into user_email, user_meta
  from auth.users u
  where u.id = me;

  perform public.social_insert_profile(me, coalesce(user_email, 'member'), coalesce(user_meta, '{}'::jsonb));
  return me;
end;
$$;

revoke all on function public.social_me() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'journal_entries',
    'profiles',
    'friendships',
    'blocks',
    'shared_timelines',
    'shared_timeline_members',
    'shared_entries',
    'notifications'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', table_name || '_email_verified', table_name);
  end loop;
end
$$;

drop policy if exists storage_email_verified on storage.objects;

commit;
