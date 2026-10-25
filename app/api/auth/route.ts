import { connection, NextResponse } from "next/server";
import { authCallbackUrl, authErrorMessage, isEmail, isEmailVerified } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase/server";
import { requestIp, verifyTurnstile } from "@/lib/turnstile";

const MAX_BODY_BYTES = 16_384;
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1_024;

type AuthRequest =
  | { flow: "login"; email: string; password: string; turnstileToken: string }
  | { flow: "signup"; email: string; password: string; turnstileToken: string }
  | { flow: "forgot"; email: string; turnstileToken: string }
  | { flow: "resend"; email: string; source: "login" | "signup"; turnstileToken: string }
  | { flow: "oauth"; source: "login" | "signup"; turnstileToken: string };

export async function POST(request: Request) {
  await connection();

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return failure("That request is too large. Refresh the page and try again.", 413);
  }

  const input = await readRequest(request);
  if (!input.ok) return failure(input.message, 400);

  const value = input.value;
  const captchaToken = value.turnstileToken;

  if (value.flow === "oauth") {
    const turnstile = await verifyTurnstile({
      token: captchaToken,
      expectedAction: turnstileAction(value),
      expectedHostname: new URL(request.url).hostname,
      remoteIp: requestIp(request.headers),
    });
    if (!turnstile.ok) {
      if (turnstile.reason === "config") {
        return failure("Bot protection is not configured. Try again later.", 503, "turnstile");
      }
      if (turnstile.reason === "unavailable") {
        return failure("Bot protection could not be checked. Check your connection and try again.", 503, "turnstile");
      }
      return failure("The bot-protection check expired or was not accepted. Complete it again.", 403, "turnstile");
    }
  }

  const supabase = await serverSupabase();
  if (!supabase) return failure("Account access is not configured. Try again later.", 503);

  if (value.flow === "login") {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: value.email,
      password: value.password,
      options: { captchaToken },
    });
    if (error) return failure(authErrorMessage(error.message), 401);
    if (!isEmailVerified(data.user)) {
      await supabase.auth.signOut();
      return failure(authErrorMessage("Email not confirmed"), 403);
    }
    return NextResponse.json({ ok: true, status: "authenticated" });
  }

  if (value.flow === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email: value.email,
      password: value.password,
      options: { emailRedirectTo: authCallbackUrl(new URL(request.url).origin, "signup"), captchaToken },
    });
    if (error) return failure(authErrorMessage(error.message), 400);
    if (!data.session || !isEmailVerified(data.user)) {
      if (data.session) await supabase.auth.signOut();
      return NextResponse.json({ ok: true, status: "confirmation_sent" });
    }
    return NextResponse.json({ ok: true, status: "authenticated" });
  }

  if (value.flow === "forgot") {
    const { error } = await supabase.auth.resetPasswordForEmail(value.email, {
      redirectTo: authCallbackUrl(new URL(request.url).origin, "recovery"),
      captchaToken,
    });
    if (error) return failure(authErrorMessage(error.message), 400);
    return NextResponse.json({ ok: true, status: "reset_sent" });
  }

  if (value.flow === "resend") {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: value.email,
      options: { emailRedirectTo: authCallbackUrl(new URL(request.url).origin, "signup"), captchaToken },
    });
    if (error) return failure(authErrorMessage(error.message), 400);
    return NextResponse.json({ ok: true, status: "confirmation_resent" });
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(new URL(request.url).origin, "oauth"),
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) return failure(authErrorMessage(error?.message ?? "OAuth could not start"), 400);
  return NextResponse.json({ ok: true, status: "oauth", url: data.url });
}

function turnstileAction(input: AuthRequest): "login" | "signup" | "forgot" {
  if (input.flow === "oauth" || input.flow === "resend") return input.source;
  return input.flow;
}

async function readRequest(
  request: Request,
): Promise<{ ok: true; value: AuthRequest } | { ok: false; message: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, message: "That request could not be read. Refresh the page and try again." };
  }
  if (!body || typeof body !== "object") return { ok: false, message: "Complete the form and try again." };

  const input = body as Record<string, unknown>;
  const flow = input.flow;
  const turnstileToken = text(input.turnstileToken);
  if (!turnstileToken) return { ok: false, message: "Complete the bot-protection check and try again." };

  if (flow === "oauth") {
    const source = authSource(input.source);
    return source
      ? { ok: true, value: { flow, source, turnstileToken } }
      : { ok: false, message: "Refresh the page and try again." };
  }

  const email = text(input.email).toLowerCase();
  if (!isEmail(email) || email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (flow === "forgot") return { ok: true, value: { flow, email, turnstileToken } };

  if (flow === "resend") {
    const source = authSource(input.source);
    return source
      ? { ok: true, value: { flow, email, source, turnstileToken } }
      : { ok: false, message: "Refresh the page and try again." };
  }

  const password = typeof input.password === "string" ? input.password : "";
  if (flow === "login") {
    if (!password || password.length > MAX_PASSWORD_LENGTH) {
      return { ok: false, message: "Enter your password." };
    }
    return { ok: true, value: { flow, email, password, turnstileToken } };
  }
  if (flow === "signup") {
    if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
      return { ok: false, message: "Use between 8 and 1,024 characters for your password." };
    }
    return { ok: true, value: { flow, email, password, turnstileToken } };
  }
  return { ok: false, message: "Refresh the page and try again." };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function authSource(value: unknown): "login" | "signup" | null {
  return value === "login" || value === "signup" ? value : null;
}

function failure(message: string, status: number, kind = "auth") {
  return NextResponse.json({ ok: false, message, kind }, { status });
}
