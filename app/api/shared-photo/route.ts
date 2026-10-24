import { connection } from "next/server";
import { isOwnedPhotoPath, PHOTO_BUCKET } from "@/lib/photo-links";
import { privateImageResponse, privateTextResponse } from "@/lib/private-image";
import { isUuid } from "@/lib/social-rules";
import { requireVerifiedUser } from "@/lib/supabase/require-user";

export async function GET(request: Request) {
  await connection();
  const gate = await requireVerifiedUser();
  if (!gate.ok) return gate.response;
  const { supabase } = gate;

  const entryId = new URL(request.url).searchParams.get("entry") ?? "";
  if (!isUuid(entryId)) return privateTextResponse("That photo is not available.", 404);

  const share = await supabase.from("shared_entries").select("entry_id").eq("entry_id", entryId).limit(1);
  if (share.error || !share.data?.length) return privateTextResponse("That photo is not available.", 404);

  const entry = await supabase.from("journal_entries").select("user_id, photo_path").eq("id", entryId).maybeSingle();
  if (entry.error || !entry.data) return privateTextResponse("That photo is not available.", 404);
  const path = entry.data.photo_path;
  const ownerId = entry.data.user_id;
  if (typeof path !== "string" || typeof ownerId !== "string" || !isOwnedPhotoPath(ownerId, path)) {
    return privateTextResponse("That photo is not available.", 404);
  }

  const downloaded = await supabase.storage.from(PHOTO_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return privateTextResponse("That photo is not available.", 404);
  return privateImageResponse(await downloaded.data.arrayBuffer());
}
