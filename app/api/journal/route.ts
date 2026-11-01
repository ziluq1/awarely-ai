import { connection } from "next/server";
import { NextResponse } from "next/server";
import { PHOTO_BUCKET } from "@/lib/account-journal";
import { parseCustomFeeling } from "@/lib/feelings";
import { serverSupabase } from "@/lib/supabase/server";
import { MOODS, REFLECTION_LIMIT } from "@/lib/types";
import type { MoodId } from "@/lib/types";

export async function POST(request: Request) {
  await connection();
  const supabase = await serverSupabase();
  if (!supabase) return json({ ok: false, message: "Supabase is not configured." }, 503);

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return json({ ok: false, message: "Sign in to save your timeline." }, 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: "That save request could not be read." }, 400);
  }

  const journalText = stringField(form, "journalText");
  const customFeeling = optionalStringField(form, "customFeeling");
  const mood = parseMood(stringField(form, "mood"));
  const photo = form.get("photo");

  const text = journalText.trim();
  if (!text) return json({ ok: false, message: "Write a few words before saving this entry." }, 400);
  if (text.length > REFLECTION_LIMIT) {
    return json({ ok: false, message: `Journal entries can be up to ${REFLECTION_LIMIT} characters.` }, 400);
  }
  const feeling = parseCustomFeeling(customFeeling);
  if (!feeling.ok) return json({ ok: false, message: feeling.message }, 400);

  const photoBlob = photo instanceof Blob && photo.size > 0 ? photo : null;
  const id = crypto.randomUUID();
  let photoPath: string | null = null;

  if (photoBlob) {
    const path = `${auth.user.id}/${id}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photoBlob, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (uploadError) {
      return json({ ok: false, message: "The photo could not be uploaded. Try a smaller JPG or PNG." }, 400);
    }
    photoPath = path;
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      id,
      user_id: auth.user.id,
      mood,
      custom_feeling: feeling.value,
      journal_text: text,
      photo_path: photoPath,
    })
    .select("id, created_at, mood, custom_feeling, journal_text, photo_path")
    .single();

  if (error || !data || typeof data !== "object") {
    if (photoPath) await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    return json({ ok: false, message: "Supabase could not save that journal change. Try again." }, 500);
  }

  const row = data as {
    id: string;
    created_at: string;
    mood: string | null;
    custom_feeling: string | null;
    journal_text: string;
    photo_path: string | null;
  };

  let photoUrl: string | null = null;
  if (photoPath) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(photoPath, 60 * 60);
    if (signedError || !signed?.signedUrl) {
      await supabase.from("journal_entries").delete().eq("id", row.id);
      await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
      return json(
        {
          ok: false,
          message: "The photo was uploaded, but a private link could not be created. The entry was not kept.",
        },
        500,
      );
    }
    photoUrl = signed.signedUrl;
  }

  return json(
    {
      ok: true,
      entry: {
        id: row.id,
        createdAt: row.created_at,
        journalText: row.journal_text,
        mood: parseMood(row.mood ?? ""),
        customFeeling: row.custom_feeling,
        photoPath: row.photo_path,
        photoUrl,
      },
    },
    200,
  );
}

function stringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function optionalStringField(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

function parseMood(value: string): MoodId | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return MOODS.some((mood) => mood.id === trimmed) ? (trimmed as MoodId) : null;
}

function json(
  body:
    | {
        ok: true;
        entry: {
          id: string;
          createdAt: string;
          journalText: string;
          mood: MoodId | null;
          customFeeling: string | null;
          photoPath: string | null;
          photoUrl: string | null;
        };
      }
    | { ok: false; message: string },
  status: number,
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
