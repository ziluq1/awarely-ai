"use client";

import { useEffect } from "react";

export function AuthHashForwarder() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=") && !hash.includes("error_code=") && !hash.includes("error_description=")) return;
    if (window.location.pathname === "/auth/callback" || window.location.pathname.startsWith("/auth/callback/")) return;
    if (window.location.pathname === "/auth/hash") return;
    const dest = new URL("/auth/callback", window.location.origin);
    dest.hash = hash.startsWith("#") ? hash.slice(1) : hash;
    const next = `${window.location.pathname}${window.location.search}`;
    if (next.startsWith("/") && !next.startsWith("//") && next !== "/") dest.searchParams.set("next", next);
    window.location.replace(dest.toString());
  }, []);

  return null;
}
