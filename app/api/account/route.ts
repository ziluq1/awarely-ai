import { connection } from "next/server";
import { NextResponse } from "next/server";
import { purgeAccountData } from "@/lib/delete-account";
import { DELETE_CONFIRMATION } from "@/lib/delete-account-rules";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  await connection();
  const supabase = await serverSupabase();
  if (!supabase) return json({ ok: false, message: "Supabase is not configured." }, 503);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return json({ ok: false, message: "Log in to delete your account." }, 401);

  let confirmation: unknown = null;
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && "confirmation" in body) {
      confirmation = body.confirmation;
    }
  } catch {
    confirmation = null;
  }
  if (confirmation !== DELETE_CONFIRMATION) {
    return json({ ok: false, message: "Type DELETE to confirm account deletion." }, 400);
  }

  const admin = adminSupabase();
  if (!admin) {
    return json(
      {
        ok: false,
        message: "Account deletion is not configured yet. Add the server-only Supabase secret key, then try again.",
      },
      503,
    );
  }

  const userId = data.user.id;
  // Wipe storage objects and every owned row before removing the auth user.
  const purged = await purgeAccountData(admin, userId);
  if (purged) return json({ ok: false, message: purged }, 500);

  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error && !/user not found/i.test(deleted.error.message)) {
    return json({ ok: false, message: "The account could not be deleted. It is still here. Try again." }, 500);
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // The auth user is already gone. The browser drops the session after this response.
  }
  return json({ ok: true }, 200);
}

function json(body: { ok: true } | { ok: false; message: string }, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
