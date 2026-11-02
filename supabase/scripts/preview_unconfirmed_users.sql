-- Preview only: users the delete-unconfirmed-users cron job would remove.
-- Does not delete anything.

select
  id,
  email,
  created_at,
  email_confirmed_at,
  now() - created_at as age
from auth.users
where email_confirmed_at is null
  and created_at < now() - interval '2 hours'
order by created_at asc;
