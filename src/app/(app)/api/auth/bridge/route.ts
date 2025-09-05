import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { signBridgeToken } from "@/lib/app-auth";
import { BRIDGE_COOKIE } from "@/constants";

export const runtime = "nodejs";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN; // no default
const COOKIE_DOMAIN = ROOT ? `.${ROOT}` : undefined;

function withCors(res: NextResponse, req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    !!ROOT &&
    (origin === `https://${ROOT}` ||
      origin === `https://www.${ROOT}` ||
      origin.endsWith(`.${ROOT}`));

  if (allowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  return res;
}

export async function GET(req: Request) {
  // Debug logging to understand what's being received
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  
  // --- DIAG START ---
  const cookieHeader = req.headers.get("cookie") || "";
  const hasSessionCookie = /(?:^|;\s*)__session=/.test(cookieHeader);
  const hasAnyClerkCookie = /__clerk|__session/.test(cookieHeader);
  // --- DIAG END ---
  
  const authz = req.headers.get("authorization") || "";

  console.log("[bridge] req", {
    host: url.host,
    origin: origin || null,
    hasCookie: !!cookieHeader,
    cookieLen: cookieHeader.length,
    hasSessionCookie,
    hasAnyClerkCookie,
    hasAuthz: authz.startsWith("Bearer "),
    authzPrefix: authz.slice(0, 10),
  });

  let userId: string | null = null;
  let sessionId: string | null = null;

  // 1) Prefer request-bound auth (reads Authorization: Bearer OR cookies on this Request)
  const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  });
  const state = await clerk.authenticateRequest(req);
  if (state.isAuthenticated) {
    const a = state.toAuth();
    userId = a.userId ?? null;
    sessionId = a.sessionId ?? null;
  }

  // 2) Fallback to App Router auth() (cookie-based)
  if (!userId) {
    const a = await auth();
    userId = a.userId ?? null;
    sessionId = a.sessionId ?? null;
  }

  const res = NextResponse.json(
    { ok: true, authenticated: Boolean(userId) },
    { status: 200 }
  );

  // helpful while testing
  res.headers.set("x-bridge-auth", userId ? "yes" : "no");
  res.headers.set("x-bridge-has-session-cookie", hasSessionCookie ? "yes" : "no");
  res.headers.set("x-bridge-has-any-clerk-cookie", hasAnyClerkCookie ? "yes" : "no");

  const secure = process.env.NODE_ENV === "production";
  // Same-site (apex<->subdomain) cookies work with Lax; simpler and more predictable.
  const sameSite = "lax" as const;

  const host = new URL(req.url).host; // e.g. "valentisimo.infinisimo.com"
  const isApex = !!ROOT && (host === ROOT || host === `www.${ROOT}`);

  if (userId) {
    const token = await signBridgeToken(
      { uid: userId, sid: sessionId ?? undefined },
      120
    );
    res.cookies.set(BRIDGE_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      path: "/",
      maxAge: 120,
    });
  } else if (isApex) {
    // clear ONLY from apex; never clear from tenant subdomains
    res.cookies.set(BRIDGE_COOKIE, "", {
      httpOnly: true,
      secure,
      sameSite,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      path: "/",
      maxAge: 0,
    });
  }

  return withCors(res, req);
}

// Optional (for completeness)
export async function OPTIONS(req: Request) {
  const res = new NextResponse(null, { status: 204 });
  return withCors(res, req);
}
