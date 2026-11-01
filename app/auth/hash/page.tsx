"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorBlock, LoadingBlock, PageHeader, buttonClass } from "@/components/ui";
import { authExchangeError, authLinkErrorFromProvider, authLinkMessage, isEmailVerified, safeNextPath } from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";

export default function AuthHashPage() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void finishHashSession().then((result) => {
      if (!alive) return;
      if (result.ok === "redirect") return;
      if (result.ok) {
        window.location.replace(result.next);
        return;
      }
      setMessage(result.message);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader eyebrow="Account" title="Finishing sign-in">
        <p>This page completes a link that returned sign-in tokens in the address bar.</p>
      </PageHeader>
      {message ? (
        <ErrorBlock title="That link did not finish sign-in" message={message}>
          <Link className={buttonClass("secondary")} href="/login">
            Back to log in
          </Link>
        </ErrorBlock>
      ) : (
        <LoadingBlock label="Checking the sign-in link." />
      )}
    </div>
  );
}

type HashResult = { ok: true; next: string } | { ok: false; message: string } | { ok: "redirect" };

async function finishHashSession(): Promise<HashResult> {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  if (search.has("code") || search.has("token_hash") || search.has("error_code") || search.has("error")) {
    const dest = new URL("/auth/callback", window.location.origin);
    search.forEach((value, key) => dest.searchParams.set(key, value));
    window.location.replace(dest.toString());
    return { ok: "redirect" };
  }

  const providerError = hash.get("error") || hash.get("error_code");
  if (providerError) {
    const code = authLinkErrorFromProvider(hash.get("error_code"), hash.get("error_description"));
    return { ok: false, message: authLinkMessage(code) };
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return {
      ok: false,
      message:
        "That link is missing its sign-in details. Open the newest email from Awarely, tap Confirm in that message, and stay in the same browser. If it still fails, go back to log in and resend the confirmation email.",
    };
  }

  const supabase = browserSupabase();
  if (!supabase) return { ok: false, message: authLinkMessage("config") };
  const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  if (error) return { ok: false, message: authLinkMessage(authExchangeError(error.message)) };
  if (!isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    return { ok: false, message: authLinkMessage("unverified") };
  }
  const next = hash.get("type") === "recovery" ? "/reset-password" : safeNextPath(search.get("next"));
  return { ok: true, next };
}
