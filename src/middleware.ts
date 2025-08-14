import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // All app routes (exclude static assets and _next)
    "/((?!.+\\.[\\w]+$|_next).*)",
    // All API + tRPC routes
    "/(api|trpc)(.*)",
  ],
};
