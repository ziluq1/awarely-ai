import { connection } from "next/server";
import { isOwnedPhotoPath, PHOTO_BUCKET } from "@/lib/photo-links";
import { privateImageResponse, privateTextResponse } from "@/lib/private-image";
import { requireVerifiedUser } from "@/lib/supabase/require-user";

export async function GET(request: Request) {
  await connection();
  const gate = await requireVerifiedUser();
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate;

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isOwnedPhotoPath(user.id, path)) return privateTextResponse("That photo is not available.", 403);

  const downloaded = await supabase.storage.from(PHOTO_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return privateTextResponse("That photo is not in your account yet.", 404);
  return privateImageResponse(await downloaded.data.arrayBuffer());
}
