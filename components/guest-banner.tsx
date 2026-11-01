"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui";

const NEXT = encodeURIComponent("/timeline");

export function GuestBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-line bg-accent px-4 py-3 text-accent-text sm:px-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <p className="text-sm leading-relaxed sm:text-base">
          You&apos;re not signed in. You can explore the timeline, but you&apos;ll need to sign in to save it.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/login?next=${NEXT}`}
            className={`${buttonClass("primary")} min-h-11 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text`}
          >
            Sign in
          </Link>
          <Link
            href={`/signup?next=${NEXT}`}
            className={`${buttonClass("secondary")} min-h-11 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text`}
          >
            Sign up
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium text-accent-text underline decoration-line underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
          >
            Dismiss
          </button>
        </div>
      </div>
    </aside>
  );
}
