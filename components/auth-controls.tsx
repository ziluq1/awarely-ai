"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
            if (message) {
              setPending(false);
              setError(message);
              return;
            }
            window.location.reload();
          });
        }}
      />
    );
  }

  if (part === "logout") return null;

  return (
    <Link href="/login" className={buttonClass("primary", compact ? "px-2.5 text-xs min-[380px]:px-3 min-[380px]:text-sm" : "w-full px-3")}>
      Log in/Sign up
    </Link>
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
  const name = user.savedName ?? user.name;
  const pathname = usePathname();
  const onProfile = pathname === "/profile";
  const logout = (
    <Button variant={compact ? "quiet" : "secondary"} className={compact ? "px-3" : "w-full"} disabled={pending} onClick={onLogout}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
  const identity = (
    <Link
      href="/profile"
      aria-label={`Your profile, ${name}`}
      aria-current={onProfile ? "page" : undefined}
      className={
        compact
          ? "flex min-w-0 items-center gap-2 rounded-full"
          : `flex min-w-0 items-center gap-3 rounded-2xl border border-line p-3 ${onProfile ? "bg-accent" : "bg-background hover:bg-accent"}`
      }
    >
      <Avatar userId={user.id} name={name} hasPhoto={user.hasAvatar} revision={user.avatarRevision} size={compact ? "sm" : "md"} />
      <div className="min-w-0">
        <p className={compact ? "sr-only" : "truncate text-sm font-medium text-foreground"}>{name}</p>
        {compact ? null : <p className="truncate text-xs text-muted">{user.email}</p>}
      </div>
    </Link>
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
  if (part === "identity") return identity;
  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-3"}>
      {identity}
      {logout}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

