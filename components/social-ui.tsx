"use client";

/* eslint-disable @next/next/no-img-element -- Profile and shared photos stay on a plain img so access is checked on each request. */

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { EmptyBlock, ErrorBlock, LoadingBlock, buttonClass, cardClass } from "@/components/ui";
import { coverPhotoSrc, profilePhotoSrc, sharedPhotoSrc } from "@/lib/social-rules";

export function AccountGate({ children }: { children: ReactNode }) {
  const { status, configured, user } = useAuth();
  if (status === "loading") return <LoadingBlock label="Checking your account." />;
  if (!configured) {
    return (
      <ErrorBlock
        title="Supabase is not configured"
        message="Add the public Supabase URL and publishable key, then refresh."
      />
    );
  }
  if (!user) {
    return (
      <EmptyBlock title="Log in to continue" message="Friends and shared timelines stay with your account.">
        <Link className={buttonClass("primary")} href="/login">
          Log in
        </Link>
      </EmptyBlock>
    );
  }
  return children;
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${cardClass} max-h-[92dvh] w-full max-w-lg overflow-y-auto p-5 sm:p-6`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-serif text-3xl text-foreground">
            {title}
          </h2>
          <button type="button" autoFocus className={buttonClass("quiet", "px-3")} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function Avatar({
  userId,
  name,
  hasPhoto,
  size = "md",
  revision = 0,
  onMissing,
}: {
  userId: string;
  name: string;
  hasPhoto: boolean;
  size?: "sm" | "md";
  revision?: number;
  onMissing?: () => void;
}) {
  const src = hasPhoto ? profilePhotoSrc(userId, revision) : "";
  const [failedSrc, setFailedSrc] = useState("");
  const dimension = size === "sm" ? "h-9 w-9 text-sm" : "h-12 w-12 text-lg";
  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full bg-accent font-serif text-accent-text ${dimension}`}
      >
        {name.trim().slice(0, 1).toUpperCase() || "A"}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => {
        setFailedSrc(src);
        onMissing?.();
      }}
      className={`shrink-0 rounded-full bg-accent object-cover ${dimension}`}
    />
  );
}

export function ChatIdentity() {
  const { user } = useAuth();
  const name = user?.savedName ?? "You";
  return (
    <div className="flex items-center gap-2">
      {user ? (
        <Avatar userId={user.id} name={name} hasPhoto={user.hasAvatar} revision={user.avatarRevision} size="sm" />
      ) : null}
      <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">{name}</p>
    </div>
  );
}

export function CoverImage({ timelineId, name, hasCover }: { timelineId: string; name: string; hasCover: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!hasCover || failed) {
    return (
      <div className="grid h-36 place-items-center rounded-2xl bg-accent text-accent-text sm:h-44">
        <span className="font-serif text-4xl">{name.trim().slice(0, 1).toUpperCase() || "A"}</span>
      </div>
    );
  }
  return (
    <img
      src={coverPhotoSrc(timelineId)}
      alt=""
      onError={() => setFailed(true)}
      className="h-36 w-full rounded-2xl bg-accent object-cover sm:h-44"
    />
  );
}

export function SharedPhoto({
  entryId,
  alt,
  className,
}: {
  entryId: string;
  alt: string;
  className: string;
}) {
  return <img src={sharedPhotoSrc(entryId)} alt={alt} className={className} />;
}

export function StatusNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-text">
      {message}
    </p>
  );
}
