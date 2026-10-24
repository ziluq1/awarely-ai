import Link from "next/link";
import { buttonClass, cardClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className={`${cardClass} mx-auto max-w-xl p-6 sm:p-8`}>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-text">Missing page</p>
      <h1 className="mt-3 font-serif text-4xl text-foreground">This page is not part of awarely.ai</h1>
      <p className="mt-3 leading-relaxed text-muted">The link may be out of date. You can return to today and start again.</p>
      <Link href="/" className={`${buttonClass("primary")} mt-6`}>
        Back to today
      </Link>
    </div>
  );
}
