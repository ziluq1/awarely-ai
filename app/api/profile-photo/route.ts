import { connection } from "next/server";
import { privateImageResponse, privateTextResponse } from "@/lib/private-image";
import { AVATAR_BUCKET, isAvatarPath, isUuid } from "@/lib/social-rules";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await connection();
  const supabase = await serverSupabase();
  if (!supabase) return privateTextResponse("Supabase is not configured.", 503);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return privateTextResponse("Log in to open this photo.", 401);

  const userId = new URL(request.url).searchParams.get("user") ?? "";
  if (!isUuid(userId)) return privateTextResponse("That photo is not available.", 404);

  const profile = await supabase.from("profiles").select("id, avatar_path").eq("id", userId).maybeSingle();
  if (profile.error || !profile.data) return privateTextResponse("That photo is not available.", 404);
  const path = profile.data.avatar_path;
  if (typeof path !== "string" || !isAvatarPath(profile.data.id, path)) {
    return privateTextResponse("That photo is not available.", 404);
  }

  const downloaded = await supabase.storage.from(AVATAR_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return privateTextResponse("That photo is not available.", 404);
  return privateImageResponse(await downloaded.data.arrayBuffer());
}
