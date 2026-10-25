import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "@/lib/account-journal";
import { ownedStoragePaths } from "@/lib/delete-account-rules";
import { AVATAR_BUCKET, COVER_BUCKET } from "@/lib/social-rules";

const OWNED_BUCKETS = [AVATAR_BUCKET, PHOTO_BUCKET, COVER_BUCKET] as const;

export async function removeOwnedFiles(admin: SupabaseClient, userId: string): Promise<string | null> {
  const folder = userId.trim().toLowerCase();
  if (!folder) return "The account could not be deleted. Try again.";
  for (const bucket of OWNED_BUCKETS) {
    const names: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const listed = await admin.storage.from(bucket).list(folder, { limit: 100, offset });
      if (listed.error) {
        if (/not found|does not exist/i.test(listed.error.message)) break;
        return "Your files could not be removed, so the account was not deleted. Try again.";
      }
      const batch = listed.data ?? [];
      for (const item of batch) {
        if (item.id && item.name) names.push(item.name);
      }
      if (batch.length < 100) break;
    }
    const paths = ownedStoragePaths(folder, names);
    if (paths.length === 0) continue;
    const removed = await admin.storage.from(bucket).remove(paths);
    if (removed.error) return "Your files could not be removed, so the account was not deleted. Try again.";
  }
  return null;
}
