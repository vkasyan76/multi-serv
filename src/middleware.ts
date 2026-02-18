import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  REFERRAL_CAPTURE_ENABLED,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_TTL_SECONDS,
} from "@/constants";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
const ENABLED = process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true";

const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/dashboard(.*)", // for tenant subdomain routing before rewrite
]);

const REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,64}$/;

function normalizeReferralCode(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\s+/g, "-").toUpperCase();
  return REFERRAL_CODE_RE.test(normalized) ? normalized : null;
}

function shouldSkipReferralCapture(pathname: string): boolean {
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  return false;
}

function attachReferralCookie(req: NextRequest, res: NextResponse): NextResponse {
  if (!REFERRAL_CAPTURE_ENABLED) return res;

  const pathname = req.nextUrl.pathname;
  if (shouldSkipReferralCapture(pathname)) return res;

  const existing = req.cookies.get(REFERRAL_COOKIE)?.value;
  if (existing) return res; // first-touch wins

  const code = normalizeReferralCode(req.nextUrl.searchParams.get("ref"));
  if (!code) return res;

  const isProd = process.env.NODE_ENV === "production";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();

  // Phase 2C: capture ref code once so it survives Clerk redirects/reloads.
  res.cookies.set(REFERRAL_COOKIE, code, {
    path: "/",
    sameSite: "lax",
    secure: isProd,
    maxAge: REFERRAL_COOKIE_TTL_SECONDS,
    ...(isProd && root ? { domain: `.${root}` } : {}),
  });

  return res;
}

// for domain rewrite:
export default clerkMiddleware(async (auth, req) => {
  // ✅ Always protect private routes (regardless of subdomain routing)
  if (isProtectedRoute(req)) await auth.protect();

  // Build baseline response first; attach referral cookie afterward.
  let res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Keep existing rewrite behavior unchanged.
  if (!pathname.startsWith("/api") && ENABLED && ROOT) {
    // Smart referral links must stay on the app router, not tenant-rewritten paths.
    const isRefRoute = pathname === "/ref" || pathname.startsWith("/ref/");
    // ✅ Avoid double-rewrite for internal routes that already include /tenants/*
    if (!pathname.startsWith("/tenants/") && !isRefRoute) {
      const host = req.headers.get("host") ?? ""; // e.g. react_jedi.infinisimo.com
      const suffix = `.${ROOT}`; // ".infinisimo.com"

      // Only handle tenant subdomains (skip apex domain and static/other hosts)
      if (host.endsWith(suffix)) {
        const slug = host.slice(0, -suffix.length); // "react_jedi"
        if (slug && slug !== "www") {
          const url = req.nextUrl.clone();
          const rest = url.pathname === "/" ? "" : url.pathname;
          url.pathname = `/tenants/${slug}${rest}`;
          res = NextResponse.rewrite(url);
        }
      }
    }
  }

  return attachReferralCookie(req, res);
});

export const config = {
  matcher: [
    // All app routes (exclude static assets and _next)
    // "/((?!.+\\.[\\w]+$|_next).*)",
    // All API + tRPC routes
    // "/(api|trpc)(.*)",

    // All app routes except Next internals, static files, and the Clerk webhook
    "/((?!_next|.*\\..*|api/clerk/webhooks).*)",
    // Explicitly include tRPC (protected by Clerk)
    "/api/trpc/:path*",
  ],
};
