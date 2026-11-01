"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { buttonClass, cardClass } from "@/components/ui";

const NEXT = encodeURIComponent("/timeline");

export function SignInPrompt({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${cardClass} w-full max-w-md p-5 sm:p-6`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-serif text-3xl text-foreground sm:text-4xl">
            Sign in to save your timeline
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`${buttonClass("quiet", "min-h-11 px-3")} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text`}
          >
            Close
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Your draft stays in this browser while you sign in. Afterward you&apos;ll return here so you can save it.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href={`/login?next=${NEXT}`}
            className={`${buttonClass("primary")} min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text`}
          >
            Sign in
          </Link>
          <Link
            href={`/signup?next=${NEXT}`}
            className={`${buttonClass("secondary")} min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text`}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
