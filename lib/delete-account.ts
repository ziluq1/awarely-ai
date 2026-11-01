import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "@/lib/account-journal";
import { ownedStoragePaths, uniqueOwnedPaths } from "@/lib/delete-account-rules";
import { AVATAR_BUCKET, COVER_BUCKET } from "@/lib/social-rules";

const OWNED_BUCKETS = [AVATAR_BUCKET, PHOTO_BUCKET, COVER_BUCKET] as const;

const FAIL_FILES = "Your files could not be removed, so the account was not deleted. Try again.";
const FAIL_ROWS = "Your account data could not be removed, so the account was not deleted. Try again.";

type OwnedFiles = {
  [AVATAR_BUCKET]: string[];
  [PHOTO_BUCKET]: string[];
  [COVER_BUCKET]: string[];
};

export async function purgeAccountData(admin: SupabaseClient, userId: string): Promise<string | null> {
  const id = userId.trim();
  if (!id) return "The account could not be deleted. Try again.";

  const tracked = await collectOwnedStoragePaths(admin, id);
  if (typeof tracked === "string") return tracked;

  const files = await removeOwnedFiles(admin, id, tracked);
  if (files) return files;

  const rows = await removeOwnedRows(admin, id);
  if (rows) return rows;

  return null;
}

export async function removeOwnedFiles(
  admin: SupabaseClient,
  userId: string,
  known: OwnedFiles = emptyOwnedFiles(),
): Promise<string | null> {
  const folder = userId.trim().toLowerCase();
  if (!folder) return "The account could not be deleted. Try again.";

  for (const bucket of OWNED_BUCKETS) {
    const listedNames: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const listed = await admin.storage.from(bucket).list(folder, { limit: 100, offset });
      if (listed.error) {
        if (/not found|does not exist/i.test(listed.error.message)) break;
        return FAIL_FILES;
      }
      const batch = listed.data ?? [];
      for (const item of batch) {
        // Folders have a null id in Supabase storage listings.
        if (item.id && item.name) listedNames.push(item.name);
      }
      if (batch.length < 100) break;
    }

    const paths = uniqueOwnedPaths(folder, [...ownedStoragePaths(folder, listedNames), ...known[bucket]]);
    if (paths.length === 0) continue;

    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const removed = await admin.storage.from(bucket).remove(chunk);
      if (removed.error) return FAIL_FILES;
    }
  }
  return null;
}

async function collectOwnedStoragePaths(admin: SupabaseClient, userId: string): Promise<OwnedFiles | string> {
  const files = emptyOwnedFiles();

  const profile = await admin.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  if (profile.error && !missingRelation(profile.error.message)) return FAIL_ROWS;
  files[AVATAR_BUCKET] = uniqueOwnedPaths(userId, [
    typeof profile.data?.avatar_path === "string" ? profile.data.avatar_path : null,
  ]);

  const covers = await admin.from("shared_timelines").select("cover_path").eq("owner_id", userId);
  if (covers.error && !missingRelation(covers.error.message)) return FAIL_ROWS;
  files[COVER_BUCKET] = uniqueOwnedPaths(
    userId,
    (covers.data ?? []).map((row) => (typeof row.cover_path === "string" ? row.cover_path : null)),
  );

  const photos = await admin.from("journal_entries").select("photo_path").eq("user_id", userId);
  if (photos.error && !missingRelation(photos.error.message)) return FAIL_ROWS;
  files[PHOTO_BUCKET] = uniqueOwnedPaths(
    userId,
    (photos.data ?? []).map((row) => (typeof row.photo_path === "string" ? row.photo_path : null)),
  );

  return files;
}

async function removeOwnedRows(admin: SupabaseClient, userId: string): Promise<string | null> {
  const rpc = await admin.rpc("purge_user_account", { target: userId });
  if (!rpc.error) return null;
  if (!missingFunction(rpc.error.message)) return FAIL_ROWS;

  // Fallback when the SQL helper has not been applied yet.
  const steps: Array<() => Promise<string | null>> = [
    () => deleteWhere(admin, "shared_entries", `entry_owner.eq.${userId},shared_by.eq.${userId}`),
    () => deleteEq(admin, "shared_timeline_members", "user_id", userId),
    () => deleteEq(admin, "shared_timelines", "owner_id", userId),
    () => deleteWhere(admin, "friendships", `requester_id.eq.${userId},addressee_id.eq.${userId}`),
    () => deleteWhere(admin, "blocks", `blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    () => deleteEq(admin, "notifications", "user_id", userId),
    () => deleteEq(admin, "journal_entries", "user_id", userId),
    () => deleteEq(admin, "profiles", "id", userId),
  ];

  for (const step of steps) {
    const error = await step();
    if (error) return error;
  }
  return null;
}

async function deleteEq(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<string | null> {
  const result = await admin.from(table).delete().eq(column, value);
  if (result.error && !missingRelation(result.error.message)) return FAIL_ROWS;
  return null;
}

async function deleteWhere(admin: SupabaseClient, table: string, filter: string): Promise<string | null> {
  const result = await admin.from(table).delete().or(filter);
  if (result.error && !missingRelation(result.error.message)) return FAIL_ROWS;
  return null;
}

function missingRelation(message: string): boolean {
  return /could not find the table|relation .* does not exist|schema cache/i.test(message);
}

function missingFunction(message: string): boolean {
  return /could not find the function|function .* does not exist|schema cache/i.test(message);
}

function emptyOwnedFiles(): OwnedFiles {
  return {
    [AVATAR_BUCKET]: [],
    [PHOTO_BUCKET]: [],
    [COVER_BUCKET]: [],
  };
}
