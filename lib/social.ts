import type { SupabaseClient } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase/browser";
import { ImagePrepError, imageFileToJpegBlob } from "@/lib/images";
import { MOODS } from "@/lib/types";
import type { MoodId } from "@/lib/types";
import {
  AVATAR_BUCKET,
  COVER_BUCKET,
  avatarObjectPath,
  coverObjectPath,
  isUuid,
} from "@/lib/social-rules";

export const SOCIAL_SETUP_MESSAGE =
  "Friends and shared timelines are not in this Supabase project yet. Run supabase/migrations/20261024040000_friends_and_shared_timelines.sql in the SQL editor, then refresh. Run the journal entries migration first if that table is not there yet.";

export type SocialResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type Person = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarPath: string | null;
};

export type Profile = Person & { searchable: boolean };

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  requester: Person | null;
  addressee: Person | null;
};

export type TimelineMember = {
  userId: string;
  role: "owner" | "member";
  status: "invited" | "active";
  person: Person | null;
};

export type TimelineSummary = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  coverPath: string | null;
  createdAt: string;
  updatedAt: string;
  myRole: "owner" | "member" | null;
  myStatus: "active" | "invited" | null;
  members: TimelineMember[];
  latestActivity: string | null;
};

export type SharedPost = {
  id: string;
  timelineId: string;
  entryId: string;
  sharedBy: string;
  allowReshare: boolean;
  createdAt: string;
  authorId: string | null;
  createdAtEntry: string | null;
  journalText: string | null;
  mood: MoodId | null;
  customFeeling: string | null;
  photoPath: string | null;
};

export type EntryShare = {
  id: string;
  timelineId: string;
  allowReshare: boolean;
  timelineName: string | null;
};

export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export function notifyAlertsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("awarely-notifications"));
}

export function socialError(error: { message?: string; code?: string } | null): string {
  const message = error?.message?.trim() ?? "";
  const code = error?.code ?? "";
  const combined = `${code} ${message}`;
  if (/PGRST202|PGRST205|42P01|schema cache|Could not find the|does not exist/i.test(combined)) {
    return SOCIAL_SETUP_MESSAGE;
  }
  if (/Bucket not found|NoSuchBucket/i.test(message)) {
    return "That private storage bucket is not set up yet. Run the friends migration in the SQL editor.";
  }
  if (/duplicate key|already exists/i.test(message)) return "That already exists.";
  if (/jwt|not authenticated/i.test(message)) return "Log in to continue.";
  if (message && message.length < 240 && !/select |insert |policy|syntax|password|token/i.test(message)) {
    return message;
  }
  return "That could not be saved. Try again.";
}

function fail(message: string): SocialResult<never> {
  return { ok: false, message };
}

function client(): SupabaseClient | null {
  return browserSupabase();
}

async function rpc(fn: string, args?: Record<string, unknown>): Promise<SocialResult<unknown>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return fail(socialError(error));
  return { ok: true, value: data };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function personFrom(value: unknown): Person | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.username !== "string" || typeof row.display_name !== "string") {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: text(row.bio),
    avatarPath: text(row.avatar_path),
  };
}

function profileFrom(value: unknown): Profile | null {
  const person = personFrom(value);
  const row = asRecord(value);
  if (!person || !row) return null;
  return { ...person, searchable: row.searchable !== false };
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asFriendStatus(value: unknown): Friendship["status"] | null {
  if (value === "pending" || value === "accepted" || value === "declined") return value;
  return null;
}

function asRole(value: unknown): "owner" | "member" | null {
  if (value === "owner" || value === "member") return value;
  return null;
}

function asMemberStatus(value: unknown): "invited" | "active" | null {
  if (value === "invited" || value === "active") return value;
  return null;
}

function asMood(value: unknown): MoodId | null {
  return typeof value === "string" && MOODS.some((mood) => mood.id === value) ? (value as MoodId) : null;
}

async function currentUserId(): Promise<string | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function ensureProfile(): Promise<SocialResult<Profile>> {
  const result = await rpc("ensure_my_profile");
  if (!result.ok) return result;
  const profile = profileFrom(result.value);
  if (!profile) return fail("Your profile could not be read.");
  return { ok: true, value: profile };
}

export async function updateProfile(input: {
  username: string;
  displayName: string;
  bio: string;
  searchable: boolean;
}): Promise<SocialResult<Profile>> {
  const result = await rpc("update_my_profile", {
    next_username: input.username.trim().toLowerCase(),
    next_display_name: input.displayName.trim(),
    next_bio: input.bio.trim(),
    next_searchable: input.searchable,
  });
  if (!result.ok) return result;
  const profile = profileFrom(result.value);
  if (!profile) return fail("Your profile could not be read.");
  return { ok: true, value: profile };
}

export async function saveAvatar(file: Blob): Promise<SocialResult<Profile>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const userId = await currentUserId();
  if (!userId) return fail("Log in to continue.");
  let blob: Blob;
  try {
    blob = await imageFileToJpegBlob(file);
  } catch (error) {
    return fail(error instanceof ImagePrepError ? error.message : "That image could not be prepared.");
  }
  const path = avatarObjectPath(userId);
  const stored = await storeAvatar(supabase, path, blob);
  if (!stored.ok) return stored;
  const saved = await rpc("set_my_avatar", { next_path: path });
  if (!saved.ok) return saved;
  const profile = profileFrom(saved.value);
  if (!profile?.avatarPath) return fail("Your profile photo was uploaded, but it was not saved on your profile.");
  return { ok: true, value: profile };
}

function isStoredAlready(error: { message?: string; statusCode?: string | number }): boolean {
  return /409|already exists|duplicate/i.test(`${error.statusCode ?? ""} ${error.message ?? ""}`);
}

function avatarStorageError(error: { message?: string }): string {
  const message = error.message?.trim() ?? "";
  if (/row-level security|policy/i.test(message)) {
    return "The profile photo could not be saved because storage blocked this account. Run the latest profile photo migration in the Supabase SQL editor.";
  }
  if (/mime|content type|invalid file/i.test(message)) return "Choose a JPG, PNG, WebP, or GIF image.";
  if (/size|too large|payload/i.test(message)) return "That image is too large. Try one under 15 MB.";
  if (/Bucket not found|NoSuchBucket/i.test(message)) {
    return "That private storage bucket is not set up yet. Run the friends migration in the SQL editor.";
  }
  if (/jwt|not authenticated/i.test(message)) return "Log in to continue.";
  return "The profile photo could not be saved. Try again.";
}

async function storeAvatar(supabase: SupabaseClient, path: string, blob: Blob): Promise<SocialResult<null>> {
  const created = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (!created.error) return { ok: true, value: null };
  if (!isStoredAlready(created.error)) return fail(avatarStorageError(created.error));
  const replaced = await supabase.storage.from(AVATAR_BUCKET).update(path, blob, {
    contentType: "image/jpeg",
  });
  if (replaced.error) return fail(avatarStorageError(replaced.error));
  return { ok: true, value: null };
}

export async function clearAvatar(): Promise<SocialResult<Profile>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const userId = await currentUserId();
  if (!userId) return fail("Log in to continue.");
  const saved = await rpc("set_my_avatar", { next_path: "" });
  if (!saved.ok) return saved;
  const profile = profileFrom(saved.value);
  if (!profile) return fail("Your profile could not be read.");
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarObjectPath(userId)]);
  return { ok: true, value: profile };
}

export async function searchPeople(query: string): Promise<SocialResult<Person[]>> {
  const result = await rpc("search_profiles", { search_text: query.trim() });
  if (!result.ok) return result;
  const people = (Array.isArray(result.value) ? result.value : [])
    .map((item) => personFrom(item))
    .filter((item): item is Person => Boolean(item));
  return { ok: true, value: people };
}

export async function profileByUsername(username: string): Promise<SocialResult<Person | null>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_path")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (error) return fail(socialError(error));
  return { ok: true, value: personFrom(data) };
}

export async function listFriendships(): Promise<SocialResult<Friendship[]>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "id, requester_id, addressee_id, status, created_at, requester:profiles!friendships_requester_id_fkey(id, username, display_name, bio, avatar_path), addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, bio, avatar_path)",
    )
    .order("created_at", { ascending: false });
  if (error) return fail(socialError(error));
  const friendships: Friendship[] = rows(data).flatMap((row) => {
    const status = asFriendStatus(row.status);
    if (!status) return [];
    if (typeof row.id !== "string" || typeof row.requester_id !== "string" || typeof row.addressee_id !== "string") {
      return [];
    }
    return [
      {
        id: row.id,
        requesterId: row.requester_id,
        addresseeId: row.addressee_id,
        status,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        requester: personFrom(one(row.requester as never)),
        addressee: personFrom(one(row.addressee as never)),
      },
    ];
  });
  return { ok: true, value: friendships };
}

export async function listBlocks(): Promise<SocialResult<Person[]>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const { data, error } = await supabase.from("blocks").select("blocked_id").order("created_at", { ascending: false });
  if (error) return fail(socialError(error));
  const ids = rows(data)
    .map((row) => row.blocked_id)
    .filter((id): id is string => typeof id === "string");
  if (!ids.length) return { ok: true, value: [] };
  const profiles = await supabase.from("profiles").select("id, username, display_name, bio, avatar_path").in("id", ids);
  if (profiles.error) return fail(socialError(profiles.error));
  return { ok: true, value: rows(profiles.data).flatMap((row) => {
    const person = personFrom(row);
    return person ? [person] : [];
  }) };
}

export async function sendFriendRequest(username: string): Promise<SocialResult<null>> {
  const result = await rpc("send_friend_request", { target_username: username.trim().toLowerCase() });
  return result.ok ? { ok: true, value: null } : result;
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<SocialResult<null>> {
  if (!isUuid(requestId)) return fail("That friend request is not available.");
  const result = await rpc("respond_friend_request", { request_id: requestId, accept });
  return result.ok ? { ok: true, value: null } : result;
}

export async function cancelFriendRequest(requestId: string): Promise<SocialResult<null>> {
  if (!isUuid(requestId)) return fail("That sent request is not available.");
  const result = await rpc("cancel_friend_request", { request_id: requestId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function removeFriend(userId: string): Promise<SocialResult<null>> {
  if (!isUuid(userId)) return fail("That friend is not available.");
  const result = await rpc("remove_friend", { target_id: userId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function blockPerson(userId: string): Promise<SocialResult<null>> {
  if (!isUuid(userId)) return fail("That person is not available.");
  const result = await rpc("block_user", { target_id: userId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function unblockPerson(userId: string): Promise<SocialResult<null>> {
  if (!isUuid(userId)) return fail("That person is not available.");
  const result = await rpc("unblock_user", { target_id: userId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function peopleNames(ids: string[]): Promise<SocialResult<Map<string, Person>>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const unique = [...new Set(ids.filter((id) => isUuid(id)))];
  if (!unique.length) return { ok: true, value: new Map() };
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_path")
    .in("id", unique);
  if (error) return fail(socialError(error));
  const map = new Map<string, Person>();
  rows(data).forEach((row) => {
    const person = personFrom(row);
    if (person) map.set(person.id, person);
  });
  return { ok: true, value: map };
}

export async function listTimelines(): Promise<SocialResult<TimelineSummary[]>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const me = await currentUserId();
  if (!me) return fail("Log in to continue.");
  const [timelines, memberships, activity] = await Promise.all([
    supabase
      .from("shared_timelines")
      .select("id, owner_id, name, description, cover_path, created_at, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("shared_timeline_members").select("timeline_id, user_id, role, status"),
    supabase.from("shared_entries").select("timeline_id, created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  if (timelines.error) return fail(socialError(timelines.error));
  if (memberships.error) return fail(socialError(memberships.error));
  if (activity.error) return fail(socialError(activity.error));

  const memberRows = rows(memberships.data).flatMap((row) => {
    const role = asRole(row.role);
    const status = asMemberStatus(row.status);
    if (typeof row.timeline_id !== "string" || typeof row.user_id !== "string" || !role || !status) return [];
    return [{ timelineId: row.timeline_id, userId: row.user_id, role, status }];
  });
  const people = await peopleNames(memberRows.map((row) => row.userId));
  if (!people.ok) return people;
  const latest = new Map<string, string>();
  rows(activity.data).forEach((row) => {
    if (typeof row.timeline_id === "string" && typeof row.created_at === "string" && !latest.has(row.timeline_id)) {
      latest.set(row.timeline_id, row.created_at);
    }
  });

  const summaries: TimelineSummary[] = rows(timelines.data).flatMap((row) => {
    if (typeof row.id !== "string" || typeof row.owner_id !== "string" || typeof row.name !== "string") return [];
    const mine = memberRows.find((member) => member.timelineId === row.id && member.userId === me);
    const members = memberRows
      .filter((member) => member.timelineId === row.id)
      .map((member) => ({
        userId: member.userId,
        role: member.role,
        status: member.status,
        person: people.value.get(member.userId) ?? null,
      }));
    return [
      {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        description: text(row.description),
        coverPath: text(row.cover_path),
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
        myRole: mine?.role ?? null,
        myStatus: mine?.status ?? null,
        members,
        latestActivity: latest.get(row.id) ?? null,
      },
    ];
  });
  return { ok: true, value: summaries };
}

export async function createTimeline(name: string, description: string): Promise<SocialResult<string>> {
  const result = await rpc("create_shared_timeline", {
    timeline_name: name.trim(),
    timeline_description: description.trim(),
  });
  if (!result.ok) return result;
  const id = text(asRecord(result.value)?.id);
  if (!id) return fail("The timeline was created, but its id could not be read.");
  return { ok: true, value: id };
}

export async function updateTimeline(timelineId: string, name: string, description: string): Promise<SocialResult<null>> {
  if (!isUuid(timelineId)) return fail("That shared timeline is not available.");
  const result = await rpc("update_shared_timeline", {
    timeline_id: timelineId,
    timeline_name: name.trim(),
    timeline_description: description.trim(),
  });
  return result.ok ? { ok: true, value: null } : result;
}

export async function saveCover(timelineId: string, file: Blob): Promise<SocialResult<null>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  if (!isUuid(timelineId)) return fail("That shared timeline is not available.");
  const userId = await currentUserId();
  if (!userId) return fail("Log in to continue.");
  let blob: Blob;
  try {
    blob = await imageFileToJpegBlob(file);
  } catch (error) {
    return fail(error instanceof ImagePrepError ? error.message : "That image could not be prepared.");
  }
  const path = coverObjectPath(userId, timelineId);
  const uploaded = await supabase.storage.from(COVER_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (uploaded.error) return fail(socialError(uploaded.error));
  const saved = await rpc("set_timeline_cover", { timeline_id: timelineId, next_path: path });
  if (!saved.ok) return saved;
  return { ok: true, value: null };
}

export async function clearCover(timelineId: string, coverPath: string | null): Promise<SocialResult<null>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const saved = await rpc("set_timeline_cover", { timeline_id: timelineId, next_path: "" });
  if (!saved.ok) return saved;
  if (coverPath) await supabase.storage.from(COVER_BUCKET).remove([coverPath]);
  return { ok: true, value: null };
}

export async function deleteTimeline(timelineId: string, coverPath: string | null): Promise<SocialResult<null>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const result = await rpc("delete_shared_timeline", { timeline_id: timelineId });
  if (!result.ok) return result;
  if (coverPath) await supabase.storage.from(COVER_BUCKET).remove([coverPath]);
  return { ok: true, value: null };
}

export async function inviteFriend(timelineId: string, friendId: string): Promise<SocialResult<null>> {
  const result = await rpc("invite_to_timeline", { timeline_id: timelineId, friend_id: friendId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function respondInvite(timelineId: string, accept: boolean): Promise<SocialResult<null>> {
  const result = await rpc("respond_timeline_invite", { timeline_id: timelineId, accept });
  return result.ok ? { ok: true, value: null } : result;
}

export async function leaveTimeline(timelineId: string): Promise<SocialResult<null>> {
  const result = await rpc("leave_shared_timeline", { timeline_id: timelineId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function removeMember(timelineId: string, memberId: string): Promise<SocialResult<null>> {
  const result = await rpc("remove_timeline_member", { timeline_id: timelineId, member_id: memberId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function listSharedPosts(timelineId: string): Promise<SocialResult<SharedPost[]>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  if (!isUuid(timelineId)) return fail("That shared timeline is not available.");
  const { data, error } = await supabase
    .from("shared_entries")
    .select("id, timeline_id, entry_id, shared_by, allow_reshare, created_at")
    .eq("timeline_id", timelineId)
    .order("created_at", { ascending: false });
  if (error) return fail(socialError(error));
  const shares = rows(data);
  const entryIds = shares.map((row) => row.entry_id).filter((id): id is string => typeof id === "string");
  if (!entryIds.length) return { ok: true, value: [] };
  const entries = await supabase
    .from("journal_entries")
    .select("id, user_id, created_at, mood, custom_feeling, journal_text, photo_path")
    .in("id", entryIds);
  if (entries.error) return fail(socialError(entries.error));
  const byId = new Map(rows(entries.data).map((row) => [row.id, row]));
  const posts = shares.flatMap((row) => {
    if (typeof row.id !== "string" || typeof row.entry_id !== "string" || typeof row.shared_by !== "string") return [];
    const entry = asRecord(byId.get(row.entry_id));
    return [
      {
        id: row.id,
        timelineId,
        entryId: row.entry_id,
        sharedBy: row.shared_by,
        allowReshare: row.allow_reshare === true,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        authorId: text(entry?.user_id),
        createdAtEntry: text(entry?.created_at),
        journalText: text(entry?.journal_text),
        mood: asMood(entry?.mood),
        customFeeling: text(entry?.custom_feeling),
        photoPath: text(entry?.photo_path),
      },
    ];
  });
  posts.sort((a, b) => (b.createdAtEntry ?? b.createdAt).localeCompare(a.createdAtEntry ?? a.createdAt));
  return { ok: true, value: posts };
}

export async function listEntryShares(entryId: string): Promise<SocialResult<EntryShare[]>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  if (!isUuid(entryId)) return fail("That entry is not available.");
  const { data, error } = await supabase
    .from("shared_entries")
    .select("id, timeline_id, allow_reshare")
    .eq("entry_id", entryId);
  if (error) return fail(socialError(error));
  const shares = rows(data);
  const timelineIds = shares.map((row) => row.timeline_id).filter((id): id is string => typeof id === "string");
  const names = new Map<string, string>();
  if (timelineIds.length) {
    const timelines = await supabase.from("shared_timelines").select("id, name").in("id", timelineIds);
    if (timelines.error) return fail(socialError(timelines.error));
    rows(timelines.data).forEach((row) => {
      if (typeof row.id === "string" && typeof row.name === "string") names.set(row.id, row.name);
    });
  }
  return {
    ok: true,
    value: shares.flatMap((row) => {
      if (typeof row.id !== "string" || typeof row.timeline_id !== "string") return [];
      return [
        {
          id: row.id,
          timelineId: row.timeline_id,
          allowReshare: row.allow_reshare === true,
          timelineName: names.get(row.timeline_id) ?? null,
        },
      ];
    }),
  };
}

export async function listActiveTimelineChoices(): Promise<SocialResult<{ id: string; name: string }[]>> {
  const result = await listTimelines();
  if (!result.ok) return result;
  return {
    ok: true,
    value: result.value
      .filter((timeline) => timeline.myStatus === "active")
      .map((timeline) => ({ id: timeline.id, name: timeline.name })),
  };
}

export async function shareEntry(timelineId: string, entryId: string, allowReshare: boolean): Promise<SocialResult<null>> {
  const result = await rpc("share_journal_entry", {
    timeline_id: timelineId,
    entry_id: entryId,
    allow_reshare: allowReshare,
  });
  return result.ok ? { ok: true, value: null } : result;
}

export async function unshareEntry(shareId: string): Promise<SocialResult<null>> {
  const result = await rpc("unshare_journal_entry", { share_id: shareId });
  return result.ok ? { ok: true, value: null } : result;
}

export async function setReshare(shareId: string, allowReshare: boolean): Promise<SocialResult<null>> {
  const result = await rpc("set_share_reshare", { share_id: shareId, allow_reshare: allowReshare });
  return result.ok ? { ok: true, value: null } : result;
}

export async function reshareEntry(sourceTimelineId: string, destinationTimelineId: string, entryId: string): Promise<SocialResult<null>> {
  const result = await rpc("reshare_journal_entry", {
    source_timeline_id: sourceTimelineId,
    destination_timeline_id: destinationTimelineId,
    entry_id: entryId,
  });
  return result.ok ? { ok: true, value: null } : result;
}

export async function listNotices(): Promise<SocialResult<Notice[]>> {
  const supabase = client();
  if (!supabase) return fail("Supabase is not configured.");
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fail(socialError(error));
  return {
    ok: true,
    value: rows(data).flatMap((row) => {
      if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.body !== "string") return [];
      return [
        {
          id: row.id,
          kind: typeof row.kind === "string" ? row.kind : "timeline_entry",
          title: row.title,
          body: row.body,
          href: typeof row.href === "string" ? row.href : "/notifications",
          readAt: text(row.read_at),
          createdAt: typeof row.created_at === "string" ? row.created_at : "",
        },
      ];
    }),
  };
}

export async function unreadCount(): Promise<number | null> {
  const supabase = client();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return null;
  return count ?? 0;
}

export async function markNoticeRead(id: string): Promise<SocialResult<null>> {
  const result = await rpc("mark_notification_read", { notification_id: id });
  if (result.ok) notifyAlertsChanged();
  return result.ok ? { ok: true, value: null } : result;
}

export async function markAllNoticesRead(): Promise<SocialResult<null>> {
  const result = await rpc("mark_all_notifications_read");
  if (result.ok) notifyAlertsChanged();
  return result.ok ? { ok: true, value: null } : result;
}

export function otherPerson(me: string, friendship: Friendship): Person | null {
  return friendship.requesterId === me ? friendship.addressee : friendship.requester;
}
