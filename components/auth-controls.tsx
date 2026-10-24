"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/social-ui";
import type { AuthProfile } from "@/lib/auth";
import { Button, buttonClass } from "@/components/ui";

export function AuthControls({ compact = false, part = "full" }: { compact?: boolean; part?: "full" | "identity" | "logout" }) {
  const auth = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (auth.status === "loading") {
    if (part === "logout") return null;
    return (
      <p className="text-xs text-muted" role="status">
        Checking sign-in…
      </p>
    );
  }

  if (auth.status === "signed-in" && auth.user && auth.verified && !auth.identityReady && part !== "logout") {
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
        part={part}
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

  if (part === "logout") return null;

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
  part,
  pending,
  error,
  onLogout,
}: {
  user: AuthProfile;
  compact: boolean;
  part: "full" | "identity" | "logout";
  pending: boolean;
  error: string;
  onLogout: () => void;
}) {
  const logout = (
    <Button variant={compact ? "quiet" : "secondary"} className={compact ? "px-3" : "w-full"} disabled={pending} onClick={onLogout}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
  if (part === "logout") {
    return (
      <div>
        {logout}
        {error ? (
          <p className="mt-2 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className={compact ? "flex items-center gap-2" : "rounded-2xl border border-line bg-background p-3"}>
      <div className={`flex min-w-0 items-center gap-2 ${compact ? "" : "gap-3"}`} aria-label={`Signed in as ${user.savedName ?? user.name}`}>
        <Avatar
          userId={user.id}
          name={user.savedName ?? user.name}
          hasPhoto={user.hasAvatar}
          revision={user.avatarRevision}
          size={compact ? "sm" : "md"}
        />
        <div className="min-w-0">
          <p className={compact ? "sr-only" : "truncate text-sm font-medium text-foreground"}>{user.savedName ?? user.name}</p>
          {compact ? null : <p className="truncate text-xs text-muted">{user.email}</p>}
        </div>
      </div>
      {part === "identity" ? null : <div className={compact ? "" : "mt-3"}>{logout}</div>}
      {error && part !== "identity" ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

