import Link from "next/link";
import { ErrorBlock, PageHeader, buttonClass, cardClass } from "@/components/ui";

type Search = { [key: string]: string | string[] | undefined };

const USED_OR_EXPIRED =
  "This link was already used or has expired. If you already confirmed your email, you can log in. Otherwise sign up again to get a new email.";

function one(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function friendlyMessage(raw: string): string {
  const text = raw.toLowerCase();
  if (!raw || text.includes("expir") || text.includes("used") || text.includes("invalid") || text.includes("otp")) {
    return USED_OR_EXPIRED;
  }
  return raw;
}

export default async function AuthConfirmErrorPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const message = friendlyMessage(one(params.message).trim());

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader eyebrow="Account" title="Confirmation did not finish">
        <p>Only the newest email link works. Older links expire after they are used or replaced.</p>
      </PageHeader>
      <div className={`${cardClass} space-y-4 p-6 sm:p-8`}>
        <ErrorBlock title="That link could not confirm your email" message={message} />
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className={buttonClass("primary")}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClass("secondary")}>
            Back to sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
