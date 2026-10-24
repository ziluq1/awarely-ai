import { connection } from "next/server";
import { isOwnedPhotoPath, PHOTO_BUCKET } from "@/lib/photo-links";
import { privateImageResponse, privateTextResponse } from "@/lib/private-image";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await connection();
  const supabase = await serverSupabase();
  if (!supabase) return privateTextResponse("Supabase is not configured.", 503);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return privateTextResponse("Log in to open this photo.", 401);

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isOwnedPhotoPath(data.user.id, path)) return privateTextResponse("That photo is not available.", 403);

  const downloaded = await supabase.storage.from(PHOTO_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return privateTextResponse("That photo is not in your account yet.", 404);
  return privateImageResponse(await downloaded.data.arrayBuffer());
}
