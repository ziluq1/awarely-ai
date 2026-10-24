import { connection } from "next/server";
import { privateImageResponse, privateTextResponse } from "@/lib/private-image";
import { COVER_BUCKET, isCoverPath, isUuid } from "@/lib/social-rules";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await connection();
  const supabase = await serverSupabase();
  if (!supabase) return privateTextResponse("Supabase is not configured.", 503);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return privateTextResponse("Log in to open this photo.", 401);

  const timelineId = new URL(request.url).searchParams.get("timeline") ?? "";
  if (!isUuid(timelineId)) return privateTextResponse("That photo is not available.", 404);

  const timeline = await supabase
    .from("shared_timelines")
    .select("id, owner_id, cover_path")
    .eq("id", timelineId)
    .maybeSingle();
  if (timeline.error || !timeline.data) return privateTextResponse("That photo is not available.", 404);
  const path = timeline.data.cover_path;
  if (
    typeof path !== "string" ||
    typeof timeline.data.owner_id !== "string" ||
    !isCoverPath(timeline.data.owner_id, timeline.data.id, path)
  ) {
    return privateTextResponse("That photo is not available.", 404);
  }

  const downloaded = await supabase.storage.from(COVER_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return privateTextResponse("That photo is not available.", 404);
  return privateImageResponse(await downloaded.data.arrayBuffer());
}
