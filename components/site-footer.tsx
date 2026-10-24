import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm leading-relaxed text-muted sm:px-6">
        <p>
          awarely.ai is a journaling space, not medical care, a diagnosis, or a crisis service. If you need immediate
          support in the US, call or text 988, or visit{" "}
          <a className="font-medium text-accent-text underline decoration-line underline-offset-4" href="https://988lifeline.org" rel="noreferrer">
            988lifeline.org
          </a>
          .
        </p>
        <nav aria-label="About" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/settings">
            Appearance
          </Link>
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/privacy">
            Privacy and storage
          </Link>
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/timeline">
            Timeline
          </Link>
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/friends">
            Friends
          </Link>
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/shared">
            Shared timelines
          </Link>
          <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/companion">
            AI Companion
          </Link>
        </nav>
      </div>
    </footer>
  );
}
