import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailVerified, safeNextPath } from "@/lib/auth";
import { publicSupabaseEnv } from "@/lib/supabase/env";

const PROTECTED_PAGES = [/^\/timeline(?:\/|$)/, /^\/friends(?:\/|$)/, /^\/shared(?:\/|$)/, /^\/profile(?:\/|$)/, /^\/notifications(?:\/|$)/];
const PROTECTED_APIS = [/^\/api\/(?:journal-photo|profile-photo|shared-photo|timeline-cover|account)(?:\/|$)/];

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (shouldForwardAuth(url) && !isAuthPath(url.pathname)) {
    const dest = url.clone();
    dest.pathname = "/auth/callback";
    return NextResponse.redirect(dest);
  }

  const protectedPage = PROTECTED_PAGES.some((pattern) => pattern.test(url.pathname));
  const protectedApi = PROTECTED_APIS.some((pattern) => pattern.test(url.pathname));
  if (!protectedPage && !protectedApi) return NextResponse.next();

  const env = publicSupabaseEnv();
  if (!env) {
    if (protectedApi) return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
    return NextResponse.redirect(new URL("/login?error=config", url.origin));
  }

  const pending: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[] = [];
  let response = NextResponse.next({ request });
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

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (user && isEmailVerified(user)) return response;

  if (protectedApi) {
    const message = user ? "Confirm your email before using your account." : "Log in to continue.";
    const denied = NextResponse.json({ ok: false, message }, { status: user ? 403 : 401 });
    pending.forEach((cookie) => denied.cookies.set(cookie.name, cookie.value, cookie.options));
    return denied;
  }

  const dest = new URL(user ? "/login?error=unverified" : "/login", url.origin);
  if (!user) dest.searchParams.set("next", safeNextPath(`${url.pathname}${url.search}`));
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
