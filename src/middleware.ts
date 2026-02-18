import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
const ENABLED = process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true";

const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/dashboard(.*)", // for tenant subdomain routing before rewrite
]);

// for domain rewrite:
export default clerkMiddleware(async (auth, req) => {
  // ✅ Always protect private routes (regardless of subdomain routing)
  if (isProtectedRoute(req)) await auth.protect();

  // Build baseline response first.
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

  return res;
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
