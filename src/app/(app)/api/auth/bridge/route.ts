import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";
import { signBridgeToken } from "@/lib/app-auth";
import { BRIDGE_COOKIE } from "@/constants";

type MinimalClerkJWT = {
  sub?: string;
  sid?: string;
};

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
  const cookieHeader = req.headers.get("cookie") || "";
  const authz = req.headers.get("authorization") || "";

  console.log("[bridge] req", {
    host: url.host,
    origin: req.headers.get("origin"),
    hasCookie: cookieHeader.includes("__clerk") || cookieHeader.includes("__session"),
    cookieLen: cookieHeader.length,
    hasAuthz: authz.startsWith("Bearer "),
    authzPrefix: authz.slice(0, 20), // harmless preview
  });

  let { userId, sessionId } = await auth();

  // Fallback: if the apex couldn't see Clerk cookies, accept a Bearer token
  if (!userId) {
    const authz = req.headers.get("authorization") || "";
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) {
      try {
        const v = (await verifyToken(m[1], {
          secretKey: process.env.CLERK_SECRET_KEY!, // must be set on Vercel
        })) as MinimalClerkJWT;

        userId = typeof v.sub === "string" ? v.sub : null;
        sessionId = typeof v.sid === "string" ? v.sid : null;
      } catch {
        // ignore; we'll respond as unauthenticated
      }
    }
  }

  const res = NextResponse.json(
    { ok: true, authenticated: Boolean(userId) },
    { status: 200 }
  );

  // helpful while testing
  res.headers.set("x-bridge-auth", userId ? "yes" : "no");

  const secure = process.env.NODE_ENV === "production";
  const sameSite = secure ? ("none" as const) : ("lax" as const);

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
