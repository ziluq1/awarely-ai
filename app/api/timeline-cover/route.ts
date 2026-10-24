import { connection } from "next/server";
import { privateImageResponse, privateTextResponse } from "@/lib/private-image";
import { COVER_BUCKET, isCoverPath, isUuid } from "@/lib/social-rules";
import { requireVerifiedUser } from "@/lib/supabase/require-user";

export async function GET(request: Request) {
  await connection();
  const gate = await requireVerifiedUser();
  if (!gate.ok) return gate.response;
  const { supabase } = gate;

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
