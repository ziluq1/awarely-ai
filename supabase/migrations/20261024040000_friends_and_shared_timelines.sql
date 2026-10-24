-- Friends, profiles, and shared timelines for awarely.ai.
-- Safe to run more than once. Does not drop journal entries, rewrite them, or make any photo bucket public.
-- Not applied by the app. Paste this whole file into the Supabase SQL Editor and run it there.
--
-- Private journal rows stay owner-only. One added SELECT policy lets an active member of a
-- shared timeline read a journal row only when that exact entry was shared there.
-- One added storage SELECT policy lets those members read that entry's photo object only.
-- Existing owner policies are not replaced.
-- Run supabase/migrations/20261024002000_journal_entries_and_photos.sql first if journal_entries is not already there.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text,
  avatar_path text,
  searchable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60),
  constraint profiles_bio_length check (bio is null or char_length(bio) between 1 and 160),
  constraint profiles_avatar_path_check check (
    avatar_path is null or avatar_path = id::text || '/avatar.jpg'
  )
);

create unique index if not exists profiles_username_key on public.profiles (username);
create index if not exists profiles_search_idx on public.profiles (username);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  addressee_id uuid not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_requester_id_fkey foreign key (requester_id) references public.profiles (id) on delete cascade,
  constraint friendships_addressee_id_fkey foreign key (addressee_id) references public.profiles (id) on delete cascade,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined'))
);

create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

create table if not exists public.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_blocker_id_fkey foreign key (blocker_id) references public.profiles (id) on delete cascade,
  constraint blocks_blocked_id_fkey foreign key (blocked_id) references public.profiles (id) on delete cascade,
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.shared_timelines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  description text,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_timelines_owner_id_fkey foreign key (owner_id) references public.profiles (id) on delete cascade,
  constraint shared_timelines_name_length check (char_length(name) between 1 and 60),
  constraint shared_timelines_description_length check (
    description is null or char_length(description) between 1 and 280
  )
);

create index if not exists shared_timelines_owner_idx on public.shared_timelines (owner_id);

create table if not exists public.shared_timeline_members (
  timeline_id uuid not null,
  user_id uuid not null,
  role text not null,
  status text not null,
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (timeline_id, user_id),
  constraint shared_timeline_members_timeline_id_fkey foreign key (timeline_id) references public.shared_timelines (id) on delete cascade,
  constraint shared_timeline_members_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade,
  constraint shared_timeline_members_invited_by_fkey foreign key (invited_by) references public.profiles (id) on delete set null,
  constraint shared_timeline_members_role_check check (role in ('owner', 'member')),
  constraint shared_timeline_members_status_check check (status in ('invited', 'active'))
);

create unique index if not exists shared_timeline_one_owner
  on public.shared_timeline_members (timeline_id)
  where role = 'owner';
create index if not exists shared_timeline_members_user_idx
  on public.shared_timeline_members (user_id, status);

create table if not exists public.shared_entries (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null,
  entry_id uuid not null,
  entry_owner uuid not null,
  shared_by uuid not null,
  allow_reshare boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_entries_timeline_id_fkey foreign key (timeline_id) references public.shared_timelines (id) on delete cascade,
  constraint shared_entries_entry_id_fkey foreign key (entry_id) references public.journal_entries (id) on delete cascade,
  constraint shared_entries_entry_owner_fkey foreign key (entry_owner) references public.profiles (id) on delete cascade,
  constraint shared_entries_shared_by_fkey foreign key (shared_by) references public.profiles (id) on delete cascade,
  constraint shared_entries_once unique (timeline_id, entry_id)
);

create index if not exists shared_entries_entry_idx on public.shared_entries (entry_id);
create index if not exists shared_entries_owner_idx on public.shared_entries (entry_owner);
create index if not exists shared_entries_timeline_created_idx on public.shared_entries (timeline_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  title text not null,
  body text not null,
  href text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade,
  constraint notifications_kind_check check (
    kind in ('friend_request', 'friend_accepted', 'timeline_invite', 'timeline_joined', 'timeline_left', 'timeline_entry')
  ),
  constraint notifications_title_length check (char_length(title) between 1 and 80),
  constraint notifications_body_length check (char_length(body) between 1 and 160),
  constraint notifications_href_check check (
    href ~ '^/(friends|shared|notifications|profile)(/[A-Za-z0-9_-]+)?$'
  )
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists journal_entries_photo_path_idx
  on public.journal_entries (photo_path)
  where photo_path is not null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at
  before update on public.friendships
  for each row execute function public.touch_updated_at();

drop trigger if exists shared_timelines_touch_updated_at on public.shared_timelines;
create trigger shared_timelines_touch_updated_at
  before update on public.shared_timelines
  for each row execute function public.touch_updated_at();

drop trigger if exists shared_timeline_members_touch_updated_at on public.shared_timeline_members;
create trigger shared_timeline_members_touch_updated_at
  before update on public.shared_timeline_members
  for each row execute function public.touch_updated_at();

drop trigger if exists shared_entries_touch_updated_at on public.shared_entries;
create trigger shared_entries_touch_updated_at
  before update on public.shared_entries
  for each row execute function public.touch_updated_at();

create or replace function public.social_allocate_username(seed text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(pg_catalog.regexp_replace(coalesce(seed, ''), '[^a-z0-9_]', '', 'g'));
  if pg_catalog.char_length(base) < 3 then
    base := 'member';
  end if;
  base := pg_catalog.left(base, 16);
  candidate := base;
  while exists (
    select 1 from public.profiles p
    where p.username = candidate and p.id is distinct from user_id
  ) loop
    n := n + 1;
    candidate := pg_catalog.left(base, 12) || n::text;
    if n > 1000 then
      candidate := 'm' || pg_catalog.substr(pg_catalog.replace(user_id::text, '-', ''), 1, 19);
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

create or replace function public.social_insert_profile(user_id uuid, user_email text, meta jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  display text;
  chosen text;
  attempt int;
begin
  if exists (select 1 from public.profiles where id = user_id) then
    return;
  end if;

  display := pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(meta->>'full_name', meta->>'name', '')),
    '[[:cntrl:]]',
    '',
    'g'
  );
  if pg_catalog.char_length(display) < 1 then
    display := 'Awarely member';
  end if;
  display := pg_catalog.left(display, 60);

  for attempt in 1..5 loop
    chosen := public.social_allocate_username(pg_catalog.split_part(coalesce(user_email, 'member'), '@', 1), user_id);
    begin
      insert into public.profiles (id, username, display_name)
      values (user_id, chosen, display);
      return;
    exception
      when unique_violation then
        if exists (select 1 from public.profiles where id = user_id) then
          return;
        end if;
    end;
  end loop;

  raise exception 'A profile could not be created. Try again.';
end;
$$;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.social_insert_profile(
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data, '{}'::jsonb)
    );
  exception
    when others then
      raise warning 'awarely profile setup skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_profile();

do $$
declare
  person record;
  display text;
  chosen text;
  attempt int;
begin
  for person in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (select 1 from public.profiles p where p.id = u.id)
  loop
    display := pg_catalog.regexp_replace(
      pg_catalog.btrim(coalesce(person.raw_user_meta_data->>'full_name', person.raw_user_meta_data->>'name', '')),
      '[[:cntrl:]]',
      '',
      'g'
    );
    if pg_catalog.char_length(display) < 1 then
      display := 'Awarely member';
    end if;
    display := pg_catalog.left(display, 60);

    for attempt in 1..5 loop
      chosen := public.social_allocate_username(
        pg_catalog.split_part(coalesce(person.email, 'member'), '@', 1),
        person.id
      );
      begin
        insert into public.profiles (id, username, display_name)
        values (person.id, chosen, display);
        exit;
      exception
        when unique_violation then
          if exists (select 1 from public.profiles where id = person.id) then
            exit;
          end if;
      end;
    end loop;
  end loop;
end
$$;

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

create or replace function public.social_notify(
  recipient uuid,
  notice_kind text,
  notice_title text,
  notice_body text,
  notice_href text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_title text := pg_catalog.left(pg_catalog.btrim(notice_title), 80);
  clean_body text := pg_catalog.left(pg_catalog.btrim(notice_body), 160);
begin
  if recipient is null or recipient = auth.uid() then
    return;
  end if;
  if pg_catalog.char_length(clean_title) < 1 then
    clean_title := 'New activity';
  end if;
  if pg_catalog.char_length(clean_body) < 1 then
    clean_body := 'There is something new to see.';
  end if;

  insert into public.notifications (user_id, kind, title, body, href)
  values (recipient, notice_kind, clean_title, clean_body, notice_href);
end;
$$;

create or replace function public.social_is_active_member(timeline uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_timeline_members m
    where m.timeline_id = timeline
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.social_has_membership(timeline uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_timeline_members m
    where m.timeline_id = timeline
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.social_owns_entry_on_timeline(timeline uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_entries se
    where se.timeline_id = timeline
      and se.entry_owner = auth.uid()
  );
$$;

create or replace function public.social_is_active_member_of_entry(entry uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shared_entries se
    join public.shared_timeline_members m
      on m.timeline_id = se.timeline_id
     and m.user_id = auth.uid()
     and m.status = 'active'
    where se.entry_id = entry
  );
$$;

create or replace function public.social_can_read_shared_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.journal_entries e
    join public.shared_entries se on se.entry_id = e.id
    join public.shared_timeline_members m
      on m.timeline_id = se.timeline_id
     and m.user_id = auth.uid()
     and m.status = 'active'
    where e.photo_path = object_name
      and e.photo_path is not null
  );
$$;

create or replace function public.social_shares_timeline(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shared_timeline_members mine
    join public.shared_timeline_members theirs
      on theirs.timeline_id = mine.timeline_id
     and theirs.user_id = other
     and theirs.status = 'active'
    where mine.user_id = auth.uid()
      and mine.status = 'active'
  );
$$;

create or replace function public.profile_json(person public.profiles)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', person.id,
    'username', person.username,
    'display_name', person.display_name,
    'bio', person.bio,
    'avatar_path', person.avatar_path,
    'searchable', person.searchable
  );
$$;

create or replace function public.ensure_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  person public.profiles;
begin
  me := public.social_me();
  select * into person from public.profiles where id = me;
  return public.profile_json(person);
end;
$$;

create or replace function public.update_my_profile(
  next_username text,
  next_display_name text,
  next_bio text,
  next_searchable boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  chosen text := lower(pg_catalog.btrim(coalesce(next_username, '')));
  display text := pg_catalog.btrim(coalesce(next_display_name, ''));
  about text := pg_catalog.btrim(coalesce(next_bio, ''));
  person public.profiles;
begin
  me := public.social_me();
  if chosen !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Usernames use 3 to 20 lowercase letters, numbers, or underscores.';
  end if;
  if display ~ '[[:cntrl:]]' or pg_catalog.char_length(display) < 1 or pg_catalog.char_length(display) > 60 then
    raise exception 'Display names need 1 to 60 characters.';
  end if;
  if about ~ '[[:cntrl:]]' or pg_catalog.char_length(about) > 160 then
    raise exception 'Bios can be up to 160 characters.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('username:' || chosen));

  if exists (select 1 from public.profiles where username = chosen and id <> me) then
    raise exception 'That username is taken.';
  end if;

  update public.profiles
  set
    username = chosen,
    display_name = display,
    bio = nullif(about, ''),
    searchable = coalesce(next_searchable, true)
  where id = me
  returning * into person;

  return public.profile_json(person);
end;
$$;

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
  if cleaned is not null and cleaned <> me::text || '/avatar.jpg' then
    raise exception 'That profile photo could not be saved.';
  end if;

  update public.profiles
  set avatar_path = cleaned
  where id = me
  returning * into person;

  return public.profile_json(person);
end;
$$;

create or replace function public.search_profiles(search_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  raw text := pg_catalog.left(pg_catalog.btrim(coalesce(search_text, '')), 40);
  q text;
  result jsonb;
begin
  me := public.social_me();
  if pg_catalog.char_length(raw) < 2 or raw ~ '[[:cntrl:]]' then
    raise exception 'Type at least 2 characters.';
  end if;
  q := pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(raw, '\', '\\'), '%', '\%'), '_', '\_');

  select coalesce(pg_catalog.jsonb_agg(row_data), '[]'::jsonb)
  into result
  from (
    select pg_catalog.jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'display_name', p.display_name,
      'bio', p.bio,
      'avatar_path', p.avatar_path
    ) as row_data
    from public.profiles p
    where p.id <> me
      and p.searchable
      and (
        p.username ilike '%' || q || '%' escape '\'
        or p.display_name ilike '%' || q || '%' escape '\'
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = me)
      )
    order by p.username
    limit 20
  ) matches;

  return result;
end;
$$;

create or replace function public.send_friend_request(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  target uuid;
  is_searchable boolean;
  existing public.friendships;
  request_id uuid;
  my_name text;
begin
  me := public.social_me();
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(target_username, ''))) > 20 then
    raise exception 'No one with that username could be found.';
  end if;

  select p.id, p.searchable into target, is_searchable
  from public.profiles p
  where p.username = lower(pg_catalog.btrim(target_username));

  if target is null then
    raise exception 'No one with that username could be found.';
  end if;
  if target = me then
    raise exception 'You cannot send a request to yourself.';
  end if;
  if not is_searchable or exists (
    select 1 from public.blocks b
    where (b.blocker_id = me and b.blocked_id = target)
       or (b.blocker_id = target and b.blocked_id = me)
  ) then
    raise exception 'No one with that username could be found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(least(me::text, target::text)),
    pg_catalog.hashtext(greatest(me::text, target::text))
  );

  select * into existing
  from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, target)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, target)
  for update;

  if existing.id is not null then
    if existing.status = 'accepted' then
      raise exception 'You are already friends.';
    end if;
    if existing.status = 'pending' and existing.requester_id = me then
      raise exception 'You already sent a request.';
    end if;
    if existing.status = 'pending' and existing.addressee_id = me then
      raise exception 'They already sent you a request. Respond to it instead.';
    end if;

    update public.friendships
    set requester_id = me, addressee_id = target, status = 'pending'
    where id = existing.id
    returning id into request_id;
  else
    insert into public.friendships (requester_id, addressee_id, status)
    values (me, target, 'pending')
    returning id into request_id;
  end if;

  select display_name into my_name from public.profiles where id = me;
  perform public.social_notify(
    target,
    'friend_request',
    'New friend request',
    my_name || ' sent you a friend request.',
    '/friends'
  );

  return pg_catalog.jsonb_build_object('id', request_id, 'status', 'pending');
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  existing public.friendships;
  my_name text;
begin
  me := public.social_me();
  select * into existing from public.friendships where id = request_id for update;
  if existing.id is null or existing.addressee_id <> me or existing.status <> 'pending' then
    raise exception 'That friend request is not waiting for you.';
  end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = me and b.blocked_id = existing.requester_id)
       or (b.blocker_id = existing.requester_id and b.blocked_id = me)
  ) then
    raise exception 'That friend request is not available.';
  end if;

  if accept then
    update public.friendships set status = 'accepted' where id = existing.id;
    select display_name into my_name from public.profiles where id = me;
    perform public.social_notify(
      existing.requester_id,
      'friend_accepted',
      'Friend request accepted',
      my_name || ' accepted your friend request.',
      '/friends'
    );
    return pg_catalog.jsonb_build_object('status', 'accepted');
  end if;

  update public.friendships set status = 'declined' where id = existing.id;
  return pg_catalog.jsonb_build_object('status', 'declined');
end;
$$;

create or replace function public.cancel_friend_request(request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  removed uuid;
begin
  me := public.social_me();
  delete from public.friendships
  where id = request_id and requester_id = me and status = 'pending'
  returning id into removed;
  if removed is null then
    raise exception 'That sent request is no longer waiting.';
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_friend(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  removed uuid;
begin
  me := public.social_me();
  if target_id = me then
    raise exception 'You cannot remove yourself.';
  end if;
  delete from public.friendships
  where status = 'accepted'
    and (
      (requester_id = me and addressee_id = target_id)
      or (addressee_id = me and requester_id = target_id)
    )
  returning id into removed;
  if removed is null then
    raise exception 'That friendship is not active.';
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.block_user(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
begin
  me := public.social_me();
  if target_id is null or target_id = me then
    raise exception 'You cannot block yourself.';
  end if;
  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'That person is not available.';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (me, target_id)
  on conflict do nothing;

  delete from public.friendships
  where (requester_id = me and addressee_id = target_id)
     or (addressee_id = me and requester_id = target_id);

  delete from public.shared_timeline_members
  where status = 'invited'
    and (
      (user_id = me and invited_by = target_id)
      or (user_id = target_id and invited_by = me)
    );

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.unblock_user(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  removed uuid;
begin
  me := public.social_me();
  delete from public.blocks
  where blocker_id = me and blocked_id = target_id
  returning blocker_id into removed;
  if removed is null then
    raise exception 'That person is not blocked.';
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.create_shared_timeline(timeline_name text, timeline_description text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  clean_name text := pg_catalog.btrim(coalesce(timeline_name, ''));
  clean_description text := pg_catalog.btrim(coalesce(timeline_description, ''));
  timeline_id uuid;
begin
  me := public.social_me();
  if clean_name ~ '[[:cntrl:]]' or pg_catalog.char_length(clean_name) < 1 or pg_catalog.char_length(clean_name) > 60 then
    raise exception 'Timeline names need 1 to 60 characters.';
  end if;
  if clean_description ~ '[[:cntrl:]]' or pg_catalog.char_length(clean_description) > 280 then
    raise exception 'Descriptions can be up to 280 characters.';
  end if;

  insert into public.shared_timelines (owner_id, name, description)
  values (me, clean_name, nullif(clean_description, ''))
  returning id into timeline_id;

  insert into public.shared_timeline_members (timeline_id, user_id, role, status)
  values (timeline_id, me, 'owner', 'active');

  return pg_catalog.jsonb_build_object('id', timeline_id);
end;
$$;

create or replace function public.update_shared_timeline(
  timeline_id uuid,
  timeline_name text,
  timeline_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  clean_name text := pg_catalog.btrim(coalesce(timeline_name, ''));
  clean_description text := pg_catalog.btrim(coalesce(timeline_description, ''));
  owner uuid;
  updated uuid;
begin
  me := public.social_me();
  if clean_name ~ '[[:cntrl:]]' or pg_catalog.char_length(clean_name) < 1 or pg_catalog.char_length(clean_name) > 60 then
    raise exception 'Timeline names need 1 to 60 characters.';
  end if;
  if clean_description ~ '[[:cntrl:]]' or pg_catalog.char_length(clean_description) > 280 then
    raise exception 'Descriptions can be up to 280 characters.';
  end if;

  select t.owner_id into owner from public.shared_timelines t where t.id = timeline_id;
  if owner is null or owner <> me then
    raise exception 'That shared timeline is not available.';
  end if;

  update public.shared_timelines
  set name = clean_name, description = nullif(clean_description, '')
  where id = timeline_id and owner_id = me
  returning id into updated;

  return pg_catalog.jsonb_build_object('id', updated);
end;
$$;

create or replace function public.set_timeline_cover(timeline_id uuid, next_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  owner uuid;
  cleaned text := nullif(pg_catalog.btrim(coalesce(next_path, '')), '');
begin
  me := public.social_me();
  select t.owner_id into owner from public.shared_timelines t where t.id = timeline_id;
  if owner is null or owner <> me then
    raise exception 'That shared timeline is not available.';
  end if;
  if cleaned is not null and cleaned <> me::text || '/' || timeline_id::text || '.jpg' then
    raise exception 'That cover image could not be saved.';
  end if;

  update public.shared_timelines
  set cover_path = cleaned
  where id = timeline_id and owner_id = me;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.delete_shared_timeline(timeline_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  removed uuid;
begin
  me := public.social_me();
  delete from public.notifications where href = '/shared/' || timeline_id::text;
  delete from public.shared_timelines
  where id = timeline_id and owner_id = me
  returning id into removed;
  if removed is null then
    raise exception 'That shared timeline is not available.';
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.invite_to_timeline(timeline_id uuid, friend_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  owner uuid;
  timeline_name text;
  my_name text;
begin
  me := public.social_me();
  if friend_id = me then
    raise exception 'You are already on this timeline.';
  end if;

  select t.owner_id, t.name into owner, timeline_name
  from public.shared_timelines t
  where t.id = timeline_id;

  if owner is null or owner <> me then
    raise exception 'That shared timeline is not available.';
  end if;
  if not exists (select 1 from public.profiles where id = friend_id) then
    raise exception 'That friend is not available.';
  end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = me and b.blocked_id = friend_id)
       or (b.blocker_id = friend_id and b.blocked_id = me)
  ) then
    raise exception 'That friend is not available.';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = me and f.addressee_id = friend_id)
        or (f.addressee_id = me and f.requester_id = friend_id)
      )
  ) then
    raise exception 'You can invite friends who have accepted your request.';
  end if;
  if exists (
    select 1 from public.shared_timeline_members m
    where m.timeline_id = timeline_id and m.user_id = friend_id
  ) then
    raise exception 'That friend is already invited or already a member.';
  end if;

  insert into public.shared_timeline_members (timeline_id, user_id, role, status, invited_by)
  values (timeline_id, friend_id, 'member', 'invited', me);

  select display_name into my_name from public.profiles where id = me;
  perform public.social_notify(
    friend_id,
    'timeline_invite',
    'Shared timeline invitation',
    my_name || ' invited you to ' || timeline_name || '.',
    '/shared/' || timeline_id::text
  );

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.respond_timeline_invite(timeline_id uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  membership public.shared_timeline_members;
  timeline_name text;
  my_name text;
  member_id uuid;
begin
  me := public.social_me();
  select * into membership
  from public.shared_timeline_members
  where timeline_id = respond_timeline_invite.timeline_id
    and user_id = me
    and status = 'invited'
  for update;

  if membership.user_id is null then
    raise exception 'That invitation is not waiting for you.';
  end if;

  if not accept then
    delete from public.shared_timeline_members
    where timeline_id = respond_timeline_invite.timeline_id and user_id = me and status = 'invited';
    return pg_catalog.jsonb_build_object('status', 'declined');
  end if;

  update public.shared_timeline_members
  set status = 'active'
  where timeline_id = respond_timeline_invite.timeline_id and user_id = me;

  select name into timeline_name from public.shared_timelines where id = respond_timeline_invite.timeline_id;
  select display_name into my_name from public.profiles where id = me;

  for member_id in
    select m.user_id
    from public.shared_timeline_members m
    where m.timeline_id = respond_timeline_invite.timeline_id
      and m.status = 'active'
      and m.user_id <> me
  loop
    perform public.social_notify(
      member_id,
      'timeline_joined',
      'New timeline member',
      my_name || ' joined ' || timeline_name || '.',
      '/shared/' || respond_timeline_invite.timeline_id::text
    );
  end loop;

  return pg_catalog.jsonb_build_object('status', 'active');
end;
$$;

create or replace function public.leave_shared_timeline(timeline_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  membership public.shared_timeline_members;
  timeline_name text;
  my_name text;
  owner uuid;
begin
  me := public.social_me();
  select * into membership
  from public.shared_timeline_members
  where timeline_id = leave_shared_timeline.timeline_id and user_id = me;

  if membership.user_id is null then
    raise exception 'That shared timeline is not available.';
  end if;
  if membership.role = 'owner' then
    raise exception 'Owners stay with the timeline. Delete it to close it for everyone.';
  end if;
  if membership.status <> 'active' then
    raise exception 'Accept or decline the invitation instead.';
  end if;

  delete from public.shared_timeline_members
  where timeline_id = leave_shared_timeline.timeline_id and user_id = me and role <> 'owner';

  select t.owner_id, t.name into owner, timeline_name
  from public.shared_timelines t
  where t.id = leave_shared_timeline.timeline_id;
  select display_name into my_name from public.profiles where id = me;
  perform public.social_notify(
    owner,
    'timeline_left',
    'A member left',
    my_name || ' left ' || timeline_name || '.',
    '/shared/' || leave_shared_timeline.timeline_id::text
  );

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_timeline_member(timeline_id uuid, member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  owner uuid;
  removed uuid;
begin
  me := public.social_me();
  if member_id = me then
    raise exception 'Delete the timeline to remove yourself as the owner.';
  end if;

  select t.owner_id into owner from public.shared_timelines t where t.id = timeline_id;
  if owner is null or owner <> me then
    raise exception 'That shared timeline is not available.';
  end if;

  delete from public.shared_timeline_members
  where timeline_id = remove_timeline_member.timeline_id
    and user_id = member_id
    and role <> 'owner'
  returning user_id into removed;

  if removed is null then
    raise exception 'That member is not on this timeline.';
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.share_journal_entry(
  timeline_id uuid,
  entry_id uuid,
  allow_reshare boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  entry_owner uuid;
  timeline_name text;
  my_name text;
  share_id uuid;
  member_id uuid;
begin
  me := public.social_me();
  select e.user_id into entry_owner from public.journal_entries e where e.id = entry_id;
  if entry_owner is null or entry_owner <> me then
    raise exception 'Only the owner of an entry can share it.';
  end if;

  select t.name into timeline_name from public.shared_timelines t where t.id = timeline_id;
  if timeline_name is null then
    raise exception 'That shared timeline is not available.';
  end if;
  if not exists (
    select 1 from public.shared_timeline_members m
    where m.timeline_id = share_journal_entry.timeline_id
      and m.user_id = me
      and m.status = 'active'
  ) then
    raise exception 'Join that shared timeline before sharing an entry there.';
  end if;

  begin
    insert into public.shared_entries (timeline_id, entry_id, entry_owner, shared_by, allow_reshare)
    values (timeline_id, entry_id, me, me, coalesce(allow_reshare, false))
    returning id into share_id;
  exception
    when unique_violation then
      raise exception 'This entry is already on that timeline.';
  end;

  update public.shared_timelines set updated_at = pg_catalog.now() where id = timeline_id;
  select display_name into my_name from public.profiles where id = me;

  for member_id in
    select m.user_id
    from public.shared_timeline_members m
    where m.timeline_id = share_journal_entry.timeline_id
      and m.status = 'active'
      and m.user_id <> me
  loop
    perform public.social_notify(
      member_id,
      'timeline_entry',
      'New shared entry',
      my_name || ' added an entry to ' || timeline_name || '.',
      '/shared/' || timeline_id::text
    );
  end loop;

  return pg_catalog.jsonb_build_object('id', share_id);
end;
$$;

create or replace function public.unshare_journal_entry(share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  removed uuid;
begin
  me := public.social_me();
  delete from public.shared_entries se
  using public.journal_entries e
  where se.id = share_id
    and e.id = se.entry_id
    and e.user_id = me
  returning se.id into removed;

  if removed is null then
    raise exception 'Only the owner of an entry can remove it from a shared timeline.';
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_share_reshare(share_id uuid, allow_reshare boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  updated uuid;
begin
  me := public.social_me();
  update public.shared_entries se
  set allow_reshare = coalesce(set_share_reshare.allow_reshare, false)
  from public.journal_entries e
  where se.id = share_id
    and e.id = se.entry_id
    and e.user_id = me
  returning se.id into updated;

  if updated is null then
    raise exception 'Only the owner of an entry can change who may share it again.';
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reshare_journal_entry(
  source_timeline_id uuid,
  destination_timeline_id uuid,
  entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  can_reshare boolean;
  entry_owner uuid;
  timeline_name text;
  my_name text;
  share_id uuid;
  member_id uuid;
begin
  me := public.social_me();
  if source_timeline_id = destination_timeline_id then
    raise exception 'This entry is already on that timeline.';
  end if;
  if not exists (
    select 1 from public.shared_timeline_members m
    where m.timeline_id = source_timeline_id and m.user_id = me and m.status = 'active'
  ) or not exists (
    select 1 from public.shared_timeline_members m
    where m.timeline_id = destination_timeline_id and m.user_id = me and m.status = 'active'
  ) then
    raise exception 'That shared timeline is not available.';
  end if;

  select se.allow_reshare into can_reshare
  from public.shared_entries se
  where se.timeline_id = source_timeline_id and se.entry_id = reshare_journal_entry.entry_id;

  if can_reshare is null then
    raise exception 'That entry is not on the timeline you chose.';
  end if;
  if not can_reshare then
    raise exception 'The owner did not allow this entry to be added to another timeline.';
  end if;

  select e.user_id into entry_owner from public.journal_entries e where e.id = reshare_journal_entry.entry_id;
  select t.name into timeline_name from public.shared_timelines t where t.id = destination_timeline_id;

  begin
    insert into public.shared_entries (timeline_id, entry_id, entry_owner, shared_by, allow_reshare)
    values (destination_timeline_id, entry_id, entry_owner, me, true)
    returning id into share_id;
  exception
    when unique_violation then
      raise exception 'This entry is already on that timeline.';
  end;

  update public.shared_timelines set updated_at = pg_catalog.now() where id = destination_timeline_id;
  select display_name into my_name from public.profiles where id = me;

  for member_id in
    select m.user_id
    from public.shared_timeline_members m
    where m.timeline_id = destination_timeline_id
      and m.status = 'active'
      and m.user_id <> me
  loop
    perform public.social_notify(
      member_id,
      'timeline_entry',
      'New shared entry',
      my_name || ' added an entry to ' || timeline_name || '.',
      '/shared/' || destination_timeline_id::text
    );
  end loop;

  if entry_owner is not null and entry_owner <> me then
    perform public.social_notify(
      entry_owner,
      'timeline_entry',
      'Your entry was added',
      my_name || ' added your entry to ' || timeline_name || '.',
      '/shared/' || destination_timeline_id::text
    );
  end if;

  return pg_catalog.jsonb_build_object('id', share_id);
end;
$$;

create or replace function public.mark_notification_read(notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
begin
  me := public.social_me();
  update public.notifications
  set read_at = coalesce(read_at, pg_catalog.now())
  where id = notification_id and user_id = me;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
begin
  me := public.social_me();
  update public.notifications
  set read_at = pg_catalog.now()
  where user_id = me and read_at is null;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.social_allocate_username(text, uuid) from public, anon, authenticated;
revoke all on function public.social_insert_profile(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_profile() from public, anon, authenticated;
revoke all on function public.social_me() from public, anon, authenticated;
revoke all on function public.social_notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.profile_json(public.profiles) from public, anon, authenticated;
revoke all on function public.social_is_active_member(uuid) from public, anon;
revoke all on function public.social_has_membership(uuid) from public, anon;
revoke all on function public.social_owns_entry_on_timeline(uuid) from public, anon;
revoke all on function public.social_shares_timeline(uuid) from public, anon;
grant execute on function public.social_is_active_member(uuid) to authenticated;
grant execute on function public.social_has_membership(uuid) to authenticated;
grant execute on function public.social_owns_entry_on_timeline(uuid) to authenticated;
grant execute on function public.social_shares_timeline(uuid) to authenticated;
revoke all on function public.social_is_active_member_of_entry(uuid) from public, anon;
revoke all on function public.social_can_read_shared_photo(text) from public, anon;
grant execute on function public.social_is_active_member_of_entry(uuid) to authenticated;
grant execute on function public.social_can_read_shared_photo(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_profile() to supabase_auth_admin;
  end if;
end
$$;

grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.update_my_profile(text, text, text, boolean) to authenticated;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.create_shared_timeline(text, text) to authenticated;
grant execute on function public.update_shared_timeline(uuid, text, text) to authenticated;
grant execute on function public.set_timeline_cover(uuid, text) to authenticated;
grant execute on function public.delete_shared_timeline(uuid) to authenticated;
grant execute on function public.invite_to_timeline(uuid, uuid) to authenticated;
grant execute on function public.respond_timeline_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_shared_timeline(uuid) to authenticated;
grant execute on function public.remove_timeline_member(uuid, uuid) to authenticated;
grant execute on function public.share_journal_entry(uuid, uuid, boolean) to authenticated;
grant execute on function public.unshare_journal_entry(uuid) to authenticated;
grant execute on function public.set_share_reshare(uuid, boolean) to authenticated;
grant execute on function public.reshare_journal_entry(uuid, uuid, uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke all on table public.profiles from public, anon;
revoke all on table public.friendships from public, anon;
revoke all on table public.blocks from public, anon;
revoke all on table public.shared_timelines from public, anon;
revoke all on table public.shared_timeline_members from public, anon;
revoke all on table public.shared_entries from public, anon;
revoke all on table public.notifications from public, anon;

grant select on table public.profiles to authenticated;
grant select on table public.friendships to authenticated;
grant select on table public.blocks to authenticated;
grant select on table public.shared_timelines to authenticated;
grant select on table public.shared_timeline_members to authenticated;
grant select on table public.shared_entries to authenticated;
grant select on table public.notifications to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.friendships enable row level security;
alter table public.friendships force row level security;
alter table public.blocks enable row level security;
alter table public.blocks force row level security;
alter table public.shared_timelines enable row level security;
alter table public.shared_timelines force row level security;
alter table public.shared_timeline_members enable row level security;
alter table public.shared_timeline_members force row level security;
alter table public.shared_entries enable row level security;
alter table public.shared_entries force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = profiles.id
    )
    or exists (
      select 1 from public.friendships f
      where f.status in ('pending', 'accepted')
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
          or (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id)
        )
    )
    or public.social_shares_timeline(id)
    or (
      searchable
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)
           or (b.blocker_id = profiles.id and b.blocked_id = (select auth.uid()))
      )
    )
  );

drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own
  on public.friendships
  for select
  to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own
  on public.blocks
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists shared_timelines_select_member on public.shared_timelines;
create policy shared_timelines_select_member
  on public.shared_timelines
  for select
  to authenticated
  using (
    public.social_has_membership(id)
    or public.social_owns_entry_on_timeline(id)
  );

drop policy if exists shared_timeline_members_select_visible on public.shared_timeline_members;
create policy shared_timeline_members_select_visible
  on public.shared_timeline_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.social_is_active_member(timeline_id)
  );

drop policy if exists shared_entries_select_visible on public.shared_entries;
create policy shared_entries_select_visible
  on public.shared_entries
  for select
  to authenticated
  using (
    entry_owner = (select auth.uid())
    or public.social_is_active_member(timeline_id)
  );

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists journal_entries_select_shared on public.journal_entries;
create policy journal_entries_select_shared
  on public.journal_entries
  for select
  to authenticated
  using (
    public.social_is_active_member_of_entry(id)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-avatars', 'profile-avatars', false, 5000000, array['image/jpeg']),
  ('timeline-covers', 'timeline-covers', false, 5000000, array['image/jpeg'])
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_select_visible on storage.objects;
drop policy if exists profile_avatars_insert_own on storage.objects;
drop policy if exists profile_avatars_update_own on storage.objects;
drop policy if exists profile_avatars_delete_own on storage.objects;
drop policy if exists timeline_covers_select_visible on storage.objects;
drop policy if exists timeline_covers_insert_own on storage.objects;
drop policy if exists timeline_covers_update_own on storage.objects;
drop policy if exists timeline_covers_delete_own on storage.objects;
drop policy if exists journal_photos_read_shared on storage.objects;

create policy profile_avatars_select_visible
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and exists (
      select 1 from public.profiles p
      where p.avatar_path = name
        and p.avatar_path = p.id::text || '/avatar.jpg'
    )
  );

create policy profile_avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and name = (select auth.uid())::text || '/avatar.jpg'
  );

create policy profile_avatars_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and name = (select auth.uid())::text || '/avatar.jpg'
  )
  with check (
    bucket_id = 'profile-avatars'
    and name = (select auth.uid())::text || '/avatar.jpg'
  );

create policy profile_avatars_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and name = (select auth.uid())::text || '/avatar.jpg'
  );

create policy timeline_covers_select_visible
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'timeline-covers'
    and exists (
      select 1 from public.shared_timelines t
      where t.cover_path = name
        and t.cover_path = t.owner_id::text || '/' || t.id::text || '.jpg'
    )
  );

create policy timeline_covers_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'timeline-covers'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ (
      '^' || (select auth.uid())::text ||
      '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.jpg$'
    )
  );

create policy timeline_covers_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'timeline-covers'
    and split_part(name, '/', 1) = (select auth.uid())::text
  )
  with check (
    bucket_id = 'timeline-covers'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ (
      '^' || (select auth.uid())::text ||
      '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.jpg$'
    )
  );

create policy timeline_covers_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'timeline-covers'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy journal_photos_read_shared
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and public.social_can_read_shared_photo(name)
  );

commit;
