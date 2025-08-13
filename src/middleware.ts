import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Exclude Next internals & the webhook; include everything else
    "/((?!_next|.*\\..*|api/clerk/webhooks).*)",
    // Explicitly include tRPC (routes that call auth())
    "/api/trpc/:path*",
  ],
};
