import Link from "next/link";
import { ErrorBlock, PageHeader, buttonClass, cardClass } from "@/components/ui";

type Search = { [key: string]: string | string[] | undefined };

function one(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function AuthConfirmErrorPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const message = one(params.message).trim() || "That confirmation link could not be used.";

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader eyebrow="Account" title="Confirmation did not finish">
        <p>Only the newest email link works. Older links expire after they are used or replaced.</p>
      </PageHeader>
      <div className={`${cardClass} space-y-4 p-6 sm:p-8`}>
        <ErrorBlock title="That link could not confirm your email" message={message} />
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className={buttonClass("primary")}>
            Sign up again
          </Link>
          <Link href="/login" className={buttonClass("secondary")}>
            Log in
          </Link>
        </div>
        <p className="text-sm text-muted">
          If you already have an account, log in or use Resend confirmation email on the login or signup page.
        </p>
      </div>
    </div>
  );
}
