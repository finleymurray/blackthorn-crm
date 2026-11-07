import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase session cookies fresh and sends signed out visitors to
 * /login. This is an optimistic check: every page also calls requireStaff(),
 * which is what actually enforces access.
 */
const PUBLIC_PATHS = ["/login", "/contact", "/api/public", "/api/health"];
const LOCAL_DEV_COOKIE = "bt_dev_staff";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const localDev = process.env.NODE_ENV !== "production" && process.env.LOCAL_DEV_AUTH === "1";
  if (localDev) {
    const signedIn = Boolean(request.cookies.get(LOCAL_DEV_COOKIE)?.value);
    if (!signedIn && !isPublic) return redirectToLogin(request);
    if (signedIn && pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return isPublic ? NextResponse.next() : redirectToLogin(request);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && !isPublic) return redirectToLogin(request);
  if (signedIn && pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
