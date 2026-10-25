-- Let the signed-in user read and replace their own profile photo.
-- Safe to run more than once. Does not delete profiles, photos, or journal rows.
-- The bucket stays private. Row level security stays on.
-- Not applied by the app. Paste this file into the Supabase SQL Editor.

begin;

drop policy if exists profile_avatars_select_own on storage.objects;

create policy profile_avatars_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and lower(name) = lower((select auth.uid())::text) || '/avatar.jpg'
  );

commit;
