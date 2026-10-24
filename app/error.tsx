"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClass, cardClass } from "@/components/ui";

export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className={`${cardClass} mx-auto max-w-xl p-6 sm:p-8`}>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Something went wrong</p>
      <h1 className="mt-3 font-serif text-4xl text-foreground">This page could not be shown</h1>
      <p className="mt-3 leading-relaxed text-muted">
        The rest of awarely.ai is still available. Trying again reloads this section. Your device journal is not cleared
        by this message.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" className={buttonClass("primary")} onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className={buttonClass("secondary")}>
          Back to today
        </Link>
      </div>
    </div>
  );
}
