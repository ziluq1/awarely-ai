import {
  authCallbackDestination,
  authExchangeError,
  authLinkErrorFromProvider,
  authLinkMessage,
  isEmailOtpType,
} from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";

export type FinishAuthResult =
  | { ok: true; next: string }
  | { ok: false; message: string };

/**
 * Completes an auth redirect in the browser.
 * Handles: #access_token (implicit), ?code= (PKCE).
 * token_hash links are forwarded to /auth/confirm for a click-to-verify POST.
 */
export async function finishAuthFromLocation(forcedNext?: string): Promise<FinishAuthResult> {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const pathname = window.location.pathname;

  const providerError = search.get("error") || search.get("error_code") || hash.get("error") || hash.get("error_code");
  if (providerError) {
    const description = search.get("error_description") || hash.get("error_description");
    const errorCode = search.get("error_code") || hash.get("error_code");
    console.error("[auth] provider redirect error:", { errorCode, description, providerError });
    return {
      ok: false,
      message: authLinkMessage(authLinkErrorFromProvider(errorCode, description)),
    };
  }

  const supabase = browserSupabase();
  if (!supabase) {
    console.error("[auth] Supabase browser client is not configured");
    return { ok: false, message: authLinkMessage("config") };
  }

  const tokenHash = search.get("token_hash");
  const otpType = search.get("type");
  if (tokenHash) {
    // Never verify OTP on page load — email scanners consume one-time links.
    // Send the user to the click-to-confirm page instead.
    if (!isEmailOtpType(otpType)) {
      console.error("[auth] token_hash rejected: missing or invalid type", { otpType, hasTokenHash: true });
      return { ok: false, message: authLinkMessage("invalid") };
    }
    const confirm = new URLSearchParams();
    confirm.set("token_hash", tokenHash);
    confirm.set("type", otpType);
    const next = search.get("next");
    if (next) confirm.set("next", next);
    else if (forcedNext) confirm.set("next", forcedNext);
    return { ok: true, next: `/auth/confirm?${confirm.toString()}` };
  }

  const code = search.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth] exchangeCodeForSession failed:", error.message, error);
      return { ok: false, message: authLinkMessage(authExchangeError(error.message)) };
    }
    const done = finishSession({
      pathname,
      type: search.get("type") || hash.get("type"),
      next: search.get("next"),
      forcedNext,
    });
    if (done.ok) clearAuthParamsFromUrl();
    return done;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.error("[auth] setSession failed:", error.message, error);
      return { ok: false, message: authLinkMessage(authExchangeError(error.message)) };
    }
    const done = finishSession({
      pathname,
      type: hash.get("type") || search.get("type"),
      next: search.get("next"),
      forcedNext,
    });
    if (done.ok) clearAuthParamsFromUrl();
    return done;
  }

  console.error("[auth] no usable auth payload in URL", {
    path: pathname,
    search: window.location.search,
    hashKeys: [...hash.keys()],
  });
  return {
    ok: false,
    message:
      "That link is missing its sign-in details. Open the newest email from Awarely, tap the link in that message, and stay in the same browser.",
  };
}

function finishSession(input: {
  pathname: string;
  type: string | null;
  next: string | null;
  forcedNext?: string;
}): FinishAuthResult {
  return {
    ok: true,
    next: authCallbackDestination({
      pathname: input.pathname,
      type: input.type,
      next: input.next,
      forcedNext: input.forcedNext,
    }),
  };
}

function clearAuthParamsFromUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}
