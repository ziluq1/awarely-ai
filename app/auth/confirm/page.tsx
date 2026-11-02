import Link from "next/link";
import { PageHeader, buttonClass, cardClass } from "@/components/ui";
import { authCallbackDestination } from "@/lib/auth";

type Search = { [key: string]: string | string[] | undefined };

function one(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function AuthConfirmPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const tokenHash = one(params.token_hash).trim();
  const type = one(params.type).trim();
  const nextParam = one(params.next).trim() || null;

  if (!tokenHash || !type) {
    return (
      <div className="mx-auto max-w-lg space-y-8">
        <PageHeader eyebrow="Account" title="This link is invalid">
          <p>Open the newest confirmation email from Awarely, or sign up again.</p>
        </PageHeader>
        <div className={`${cardClass} p-6 sm:p-8`}>
          <Link href="/signup" className={buttonClass("primary")}>
            Back to sign up
          </Link>
        </div>
      </div>
    );
  }

  const next = authCallbackDestination({
    pathname: "/auth/confirm",
    type,
    next: nextParam,
  });

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader eyebrow="Account" title="Confirm your email">
        <p>Tap the button below to finish confirming. Email apps that open links in the background cannot use this step.</p>
      </PageHeader>
      <div className={`${cardClass} p-6 sm:p-8`}>
        <form method="POST" action="/auth/confirm/submit" className="space-y-4">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={buttonClass("primary", "w-full")}>
            Confirm my email
          </button>
        </form>
      </div>
    </div>
  );
}
