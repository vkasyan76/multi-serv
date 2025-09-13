import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
const ENABLED = process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true";

// for domain rewrite:
export default clerkMiddleware((auth, req) => {
  // Don't touch anything unless subdomain routing is on and we know the root domain
  if (!ENABLED || !ROOT) return NextResponse.next();

  // ⛔️ Never rewrite API (incl. tRPC) calls
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api")) return NextResponse.next();

  const host = req.headers.get("host") ?? ""; // e.g. react_jedi.infinisimo.com
  const suffix = `.${ROOT}`; // ".infinisimo.com"

  // Only handle tenant subdomains (skip apex domain and static/other hosts)
  if (!host.endsWith(suffix)) return NextResponse.next();

  const slug = host.slice(0, -suffix.length); // "react_jedi"
  if (!slug || slug === "www") return NextResponse.next();

  // Rewrite to your existing tenant route, preserving the path after "/"
  // Example: /services -> /tenants/react_jedi/services
  const url = req.nextUrl.clone();
  const rest = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `/tenants/${slug}${rest}`;

  return NextResponse.rewrite(url);
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
