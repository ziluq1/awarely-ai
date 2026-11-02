import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { publicSupabaseEnv } from "@/lib/supabase/env";

const PROTECTED_PAGES = [/^\/friends(?:\/|$)/, /^\/shared(?:\/|$)/, /^\/profile(?:\/|$)/, /^\/notifications(?:\/|$)/];
const PROTECTED_APIS = [/^\/api\/(?:journal-photo|journal|profile-photo|shared-photo|timeline-cover|account)(?:\/|$)/];
const AUTH_PAGES = new Set(["/login", "/signup"]);

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (shouldForwardAuth(url) && !isAuthPath(url.pathname)) {
    const dest = url.clone();
    dest.pathname = "/auth/callback";
    return NextResponse.redirect(dest);
  }

  const env = publicSupabaseEnv();
  const protectedPage = PROTECTED_PAGES.some((pattern) => pattern.test(url.pathname));
  const protectedApi = PROTECTED_APIS.some((pattern) => pattern.test(url.pathname));
  const authPage = AUTH_PAGES.has(url.pathname);

  if (!env) {
    if (protectedApi) return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
    if (protectedPage) return NextResponse.redirect(new URL("/login?error=config", url.origin));
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const pending: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[] = [];
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
          pending.push({ name, value, options });
        });
      },
    },
  });

  // Refresh the session on every matched request. Prefer getUser over getSession.
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (user && authPage) {
    const next = safeNextPath(url.searchParams.get("next"));
    const dest = NextResponse.redirect(new URL(next === "/login" || next === "/signup" ? "/" : next, url.origin));
    pending.forEach((cookie) => dest.cookies.set(cookie.name, cookie.value, cookie.options));
    return dest;
  }

  if (user || (!protectedPage && !protectedApi)) {
    return response;
  }

  if (protectedApi) {
    const denied = NextResponse.json({ ok: false, message: "Log in to continue." }, { status: 401 });
    pending.forEach((cookie) => denied.cookies.set(cookie.name, cookie.value, cookie.options));
    return denied;
  }

  const dest = new URL("/login", url.origin);
  dest.searchParams.set("next", safeNextPath(`${url.pathname}${url.search}`));
  const redirect = NextResponse.redirect(dest);
  pending.forEach((cookie) => redirect.cookies.set(cookie.name, cookie.value, cookie.options));
  return redirect;
}

function isAuthPath(pathname: string): boolean {
  return (
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/") ||
    pathname === "/auth/confirm" ||
    pathname === "/auth/hash"
  );
}

function shouldForwardAuth(url: URL): boolean {
  if (url.searchParams.has("code") || url.searchParams.has("token_hash")) return true;
  const code = url.searchParams.get("error_code");
  return code === "otp_expired" || code === "otp_disabled" || code === "access_denied";
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
