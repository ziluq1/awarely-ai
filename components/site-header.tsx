"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthControls } from "@/components/auth-controls";
import { useAuth } from "@/components/auth-provider";
import { NAV } from "@/lib/nav";
import { unreadCount } from "@/lib/social";

export function SiteHeader() {
  const pathname = usePathname();
  return <AppNav pathname={pathname} />;
}

export function HeaderFallback() {
  return <AppNav pathname={null} />;
}

function AppNav({ pathname }: { pathname: string | null }) {
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-card/80 px-4 py-6 md:flex">
        <Brand />
        <AuthControls />
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} current={isCurrent(pathname, item.href)} />
          ))}
          <NavLink href="/shared" label="Shared" current={isCurrent(pathname, "/shared")} />
          <AlertsLink pathname={pathname} current={isCurrent(pathname, "/notifications")} />
          <NavLink href="/settings" label="Settings" current={pathname === "/settings"} />
        </nav>
      </aside>
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-line/80 bg-background/90 px-3 py-2 backdrop-blur-md md:hidden">
        <Brand compact />
        <div className="ml-auto flex w-full items-center justify-end gap-2 min-[430px]:w-auto">
          <AuthControls compact />
          <AlertsLink pathname={pathname} current={isCurrent(pathname, "/notifications")} toolbar />
          <NavLink href="/settings" label="Settings" current={pathname === "/settings"} toolbar />
        </div>
      </div>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line/80 bg-background/95 px-1 pt-1 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
      >
        {NAV.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.short} current={isCurrent(pathname, item.href)} compact />
        ))}
      </nav>
    </>
  );
}

function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AlertsLink({
  current,
  pathname,
  toolbar = false,
}: {
  current: boolean;
  pathname: string | null;
  toolbar?: boolean;
}) {
  const { status } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "signed-in") return;
    let alive = true;
    function load() {
      void unreadCount().then((value) => {
        if (alive) setCount(value);
      });
    }
    load();
    window.addEventListener("awarely-notifications", load);
    return () => {
      alive = false;
      window.removeEventListener("awarely-notifications", load);
    };
  }, [pathname, status]);

  const label = count ? `Alerts (${count})` : "Alerts";
  return <NavLink href="/notifications" label={label} current={current} toolbar={toolbar} />;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`flex min-w-0 items-center rounded-full ${compact ? "gap-2" : "gap-3"}`} aria-label="awarely.ai home">
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full bg-accent font-serif text-accent-text ${
          compact ? "h-9 w-9 text-base" : "h-11 w-11 text-lg"
        }`}
      >
        A
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-serif leading-none text-foreground ${compact ? "text-lg" : "text-xl"}`}>
          awarely.ai
        </span>
        {compact ? null : <span className="mt-1 block text-xs text-muted">A quiet journal</span>}
      </span>
    </Link>
  );
}

function NavLink({
  href,
  label,
  current,
  compact = false,
  toolbar = false,
}: {
  href: string;
  label: string;
  current: boolean;
  compact?: boolean;
  toolbar?: boolean;
}) {
  const tone = current ? "bg-accent text-accent-text" : "text-foreground hover:bg-accent/70";
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={
        compact
          ? `flex min-h-14 min-w-0 flex-1 items-center justify-center rounded-2xl px-0.5 text-center text-[0.7rem] font-medium leading-tight min-[380px]:text-xs ${tone}`
          : toolbar
            ? `inline-flex min-h-11 items-center rounded-full px-2.5 text-xs font-medium min-[380px]:px-3 min-[380px]:text-sm ${tone}`
            : `flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium ${tone}`
      }
    >
      {label}
    </Link>
  );
}
