"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorBlock, LoadingBlock, PageHeader, buttonClass } from "@/components/ui";
import { authExchangeError, authLinkErrorFromProvider, authLinkMessage, isEmailVerified, safeNextPath } from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";

export default function ConfirmEmailPage() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void confirmFromHash().then((result) => {
      if (!alive) return;
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
      <PageHeader eyebrow="Account" title="Confirming your email">
        <p>This page finishes the link from your email.</p>
      </PageHeader>
      {message ? (
        <ErrorBlock title="That link did not confirm the email" message={message}>
          <Link className={buttonClass("secondary")} href="/login">
            Back to log in
          </Link>
        </ErrorBlock>
      ) : (
        <LoadingBlock label="Checking the confirmation link." />
      )}
    </div>
  );
}

async function confirmFromHash(): Promise<{ ok: true; next: string } | { ok: false; message: string }> {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const providerError = hash.get("error") || hash.get("error_code");
  if (providerError) {
    const code = authLinkErrorFromProvider(hash.get("error_code"), hash.get("error_description"));
    return { ok: false, message: authLinkMessage(code) };
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return { ok: false, message: authLinkMessage("invalid") };
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
  const next = hash.get("type") === "recovery" ? "/reset-password" : safeNextPath(nextParam);
  return { ok: true, next };
}
