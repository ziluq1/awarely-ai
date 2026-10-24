"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { AuthProfile } from "@/lib/auth";
import { Button, buttonClass } from "@/components/ui";

export function AuthControls({ compact = false }: { compact?: boolean }) {
  const auth = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (auth.status === "loading") {
    return (
      <p className="text-xs text-muted" role="status">
        Checking sign-in…
      </p>
    );
  }

  if (auth.status === "signed-in" && auth.user) {
    return (
      <SignedIn
        user={auth.user}
        compact={compact}
        pending={pending}
        error={error}
        onLogout={() => {
          setError("");
          setPending(true);
          void auth.signOut().then((message) => {
            setPending(false);
            if (message) setError(message);
          });
        }}
      />
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className={buttonClass("quiet", "px-2.5 text-xs min-[380px]:px-3 min-[380px]:text-sm")}>
          Log in
        </Link>
        <Link href="/signup" className={buttonClass("primary", "px-2.5 text-xs min-[380px]:px-3 min-[380px]:text-sm")}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Link href="/login" className={buttonClass("secondary", "px-3")}>
        Log in
      </Link>
      <Link href="/signup" className={buttonClass("primary", "px-3")}>
        Sign up
      </Link>
    </div>
  );
}

function SignedIn({
  user,
  compact,
  pending,
  error,
  onLogout,
}: {
  user: AuthProfile;
  compact: boolean;
  pending: boolean;
  error: string;
  onLogout: () => void;
}) {
  return (
    <div className={compact ? "flex items-center gap-2" : "rounded-2xl border border-line bg-background p-3"}>
      <div className={`flex min-w-0 items-center gap-2 ${compact ? "" : "gap-3"}`} aria-label={`Signed in as ${user.name}`}>
        <Avatar user={user} compact={compact} />
        <div className="min-w-0">
          <p className={compact ? "sr-only" : "truncate text-sm font-medium text-foreground"}>{user.name}</p>
          {compact ? null : <p className="truncate text-xs text-muted">{user.email}</p>}
        </div>
      </div>
      <Button variant={compact ? "quiet" : "secondary"} className={compact ? "px-3" : "mt-3 w-full"} disabled={pending} onClick={onLogout}>
        {pending ? "Logging out…" : "Log out"}
      </Button>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Avatar({ user, compact }: { user: AuthProfile; compact: boolean }) {
  const size = compact ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
  return (
    <span aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-full bg-accent font-serif text-accent-text`}>
      {initial}
    </span>
  );
}
