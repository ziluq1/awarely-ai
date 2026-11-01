-- Require a confirmed email before account data can be read or changed.
-- Safe to run more than once. Does not delete users, profiles, journal rows, or photos.
-- Run the journal and friends migrations first if those tables are not already there.
-- Not applied by the app. Paste this file into the Supabase SQL Editor.
-- Also set Authentication → URL configuration:
--   Site URL: https://awarely-ai.vercel.app
--   Redirect URLs: https://awarely-ai.vercel.app/auth/callback
--                  https://awarely-ai.vercel.app/auth/callback/**
--                  https://awarely-ai.vercel.app/auth/confirm
--                  http://localhost:3000/auth/callback
--                  http://localhost:3000/auth/callback/**
--                  http://localhost:3000/auth/confirm
--
-- Authentication → Email templates → Confirm signup (PKCE / SSR):
--   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Confirm email</a>
-- Same pattern for Magic link and Reset password (use type=recovery and next=/reset-password for reset).

begin;

create or replace function public.email_is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and email_confirmed_at is not null
  );
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
  confirmed timestamptz;
begin
  if me is null then
    raise exception 'Log in to continue.';
  end if;

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb), u.email_confirmed_at
  into user_email, user_meta, confirmed
  from auth.users u
  where u.id = me;

  if confirmed is null then
    raise exception 'Confirm your email before using your account.';
  end if;

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
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.email_is_verified()) with check (public.email_is_verified())',
      table_name || '_email_verified',
      table_name
    );
  end loop;
end
$$;

drop policy if exists storage_email_verified on storage.objects;
create policy storage_email_verified
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (public.email_is_verified())
  with check (public.email_is_verified());

commit;
