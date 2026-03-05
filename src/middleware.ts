import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import type { AppLang } from "@/lib/i18n/app-lang";
import {
  LOCALE_COOKIE_NAME,
  resolveLocaleFromRequest,
  stripLeadingLocale,
  withLocalePrefix,
} from "@/i18n/routing";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
const ENABLED = process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true";

const STATIC_EXACT_BYPASS = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

const STATIC_EXT_BYPASS =
  /\.(?:png|jpe?g|gif|webp|svg|ico|txt|xml|css|js|map|woff2?|ttf|eot)$/i;

const REDIRECT_PARAM_KEYS = ["redirect_url", "returnTo", "return_to"] as const;

function isProtectedPath(pathname: string) {
  return (
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  );
}

function isTechnicalBypass(pathname: string) {
  // Keep platform internals/APIs/admin outside locale redirect and tenant rewrite flows.
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/_vercel")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/trpc")) return true;
  if (pathname.startsWith("/admin")) return true;
  if (STATIC_EXACT_BYPASS.has(pathname)) return true;
  if (STATIC_EXT_BYPASS.test(pathname)) return true;
  return false;
}

function maybeSetLocaleCookie(req: NextRequest, res: NextResponse, lang: AppLang) {
  // Avoid sending Set-Cookie on every request; only write when language actually changes.
  const current = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (current === lang) return;

  res.cookies.set(LOCALE_COOKIE_NAME, lang, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}

function withAppLangHeader(req: NextRequest, lang: AppLang) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-app-lang", lang);
  return requestHeaders;
}

function normalizeRedirectLikePath(value: string, lang: AppLang) {
  if (!value.startsWith("/")) return value;

  try {
    const url = new URL(value, "https://infinisimo.local");
    const pathOnly = url.pathname;
    const stripped = stripLeadingLocale(pathOnly);

    if (stripped.lang) return `${pathOnly}${url.search}`;
    if (isTechnicalBypass(pathOnly)) return `${pathOnly}${url.search}`;

    const prefixed = withLocalePrefix(pathOnly, lang);
    return `${prefixed}${url.search}`;
  } catch {
    return value;
  }
}

function normalizeAuthRedirectParams(url: URL, lang: AppLang) {
  let changed = false;

  for (const key of REDIRECT_PARAM_KEYS) {
    const current = url.searchParams.get(key);
    if (!current) continue;

    const normalized = normalizeRedirectLikePath(current, lang);
    if (normalized !== current) {
      url.searchParams.set(key, normalized);
      changed = true;
    }
  }

  return changed;
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  const stripped = stripLeadingLocale(pathname);

  // Strict technical bypass.
  if (isTechnicalBypass(pathname)) {
    return NextResponse.next();
  }

  // Canonicalize locale-prefixed technical paths (e.g. /en/api/* -> /api/*).
  if (stripped.lang && isTechnicalBypass(stripped.restPathname)) {
    const canonical = req.nextUrl.clone();
    canonical.pathname = stripped.restPathname;
    return NextResponse.redirect(canonical);
  }

  const lang = stripped.lang ?? resolveLocaleFromRequest(req);

  // Prefix page routes when locale segment is missing.
  if (!stripped.lang) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = withLocalePrefix(pathname, lang);
    const res = NextResponse.redirect(redirectUrl);
    maybeSetLocaleCookie(req, res, lang);
    return res;
  }

  // Normalize Clerk callback/deep-link redirect params.
  const normalizedUrl = req.nextUrl.clone();
  if (normalizeAuthRedirectParams(normalizedUrl, lang)) {
    const res = NextResponse.redirect(normalizedUrl);
    maybeSetLocaleCookie(req, res, lang);
    return res;
  }

  const restPathname = stripped.restPathname;

  // Protect using de-localized path.
  if (isProtectedPath(restPathname)) {
    await auth.protect();
  }

  // Keep existing tenant subdomain rewrite behavior on de-localized path.
  if (ENABLED && ROOT) {
    const isRefRoute = restPathname === "/ref" || restPathname.startsWith("/ref/");
    if (!restPathname.startsWith("/tenants/") && !isRefRoute) {
      const host =
        req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
      const suffix = `.${ROOT}`;

      if (host.endsWith(suffix)) {
        const slug = host.slice(0, -suffix.length);
        if (slug && slug !== "www") {
          const rewriteUrl = req.nextUrl.clone();
          const rest = restPathname === "/" ? "" : restPathname;
          // Phase 2: tenant rewrite now lands on localized app routes.
          rewriteUrl.pathname = `/${lang}/tenants/${slug}${rest}`;
          const res = NextResponse.rewrite(rewriteUrl, {
            request: { headers: withAppLangHeader(req, lang) },
          });
          maybeSetLocaleCookie(req, res, lang);
          return res;
        }
      }
    }
  }

  // Phase 2: localized app routes are real route segments; no bridge rewrite needed.
  const res = NextResponse.next({
    request: { headers: withAppLangHeader(req, lang) },
  });
  maybeSetLocaleCookie(req, res, lang);
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|_vercel|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
