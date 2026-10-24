import { connection } from "next/server";
import { privateImageResponse, privateTextResponse } from "@/lib/private-image";
import { AVATAR_BUCKET, isAvatarPath, isUuid } from "@/lib/social-rules";
import { requireVerifiedUser } from "@/lib/supabase/require-user";

export async function GET(request: Request) {
  await connection();
  const gate = await requireVerifiedUser();
  if (!gate.ok) return gate.response;
  const { supabase } = gate;

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
