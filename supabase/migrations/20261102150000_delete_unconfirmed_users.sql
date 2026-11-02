-- Delete auth users who never confirmed email after 2 hours.
-- Safe to re-run. Uses pg_cron (available on Supabase Pro; enable Cron in Dashboard if needed).
-- Direct FKs to auth.users already use ON DELETE CASCADE:
--   public.profiles(id), public.journal_entries(user_id).
-- Social tables cascade through profiles / journal_entries.

-- Allow scheduling SQL jobs.
create extension if not exists pg_cron with schema extensions;

-- Drop any previous version of this job so re-running the migration is safe.
do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'delete-unconfirmed-users'
  ) then
    perform cron.unschedule('delete-unconfirmed-users');
  end if;
end
$$;

-- Every 15 minutes, remove signups that stayed unconfirmed for 2+ hours.
select cron.schedule(
  'delete-unconfirmed-users',
  '*/15 * * * *',
  $job$
    delete from auth.users
    where email_confirmed_at is null
      and created_at < now() - interval '2 hours';
  $job$
);
