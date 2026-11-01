-- Explicit account wipe helpers for awarely.ai.
-- Safe to run more than once. Does not delete existing users by itself.
-- The app deletes storage objects, then related rows, then auth.users.
-- This function is a SQL-side safety net the service role can call.

create or replace function public.purge_user_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target is null then
    raise exception 'A user id is required.';
  end if;

  if (select auth.uid()) is distinct from target
     and coalesce((select auth.jwt() ->> 'role'), '') is distinct from 'service_role' then
    raise exception 'Not allowed.';
  end if;

  delete from public.shared_entries
  where entry_owner = target or shared_by = target;

  delete from public.shared_timeline_members
  where user_id = target;

  delete from public.shared_timelines
  where owner_id = target;

  delete from public.friendships
  where requester_id = target or addressee_id = target;

  delete from public.blocks
  where blocker_id = target or blocked_id = target;

  delete from public.notifications
  where user_id = target;

  delete from public.journal_entries
  where user_id = target;

  delete from public.profiles
  where id = target;
end;
$$;

revoke all on function public.purge_user_account(uuid) from public;
grant execute on function public.purge_user_account(uuid) to authenticated;
grant execute on function public.purge_user_account(uuid) to service_role;
