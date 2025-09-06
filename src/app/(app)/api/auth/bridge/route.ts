// src/app/(app)/api/auth/bridge/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";
import { signBridgeToken } from "@/lib/app-auth";
import { BRIDGE_COOKIE } from "@/constants";

export const runtime = "nodejs";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN; // no default
const COOKIE_DOMAIN = ROOT ? `.${ROOT}` : undefined;

const BRIDGE_TTL_S = 600; // 10 minutes (was 120)

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
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type"
    );
  }
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = req.headers.get("origin") ?? undefined;

  // --- DIAG START ---
  const cookieHeader = req.headers.get("cookie") || "";
  const hasSessionCookie = /(?:^|;\s*)__session=/.test(cookieHeader);
  const hasAnyClerkCookie = /__clerk|__session/.test(cookieHeader);
  const hasBridgeCookie = new RegExp(`(?:^|;\\s*)${BRIDGE_COOKIE}=`).test(
    cookieHeader
  );
  const authz = req.headers.get("authorization") || "";
  // --- DIAG END ---

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
  let source: "none" | "bearer" | "cookie" | "auth()" = "none";

  // ---- 1) Bearer-first: verify explicit Authorization header ----
  const bearer = authz.startsWith("Bearer ") ? authz.slice(7).trim() : null;
  if (bearer) {
    try {
      const v = (await verifyToken(bearer, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        audience: "bridge",
      })) as unknown as {
        sub?: string;
        sid?: string;
        iat?: number;
        exp?: number;
      };
      userId = typeof v.sub === "string" ? v.sub : null;
      sessionId = typeof v.sid === "string" ? v.sid : null;
      source = userId ? "bearer" : source;
      console.log("[bridge] bearer OK", {
        sub_tail: userId?.slice(-6),
        sid_tail: sessionId?.slice(-6),
        iat: v.iat,
        exp: v.exp,
      });
    } catch (e) {
      console.log("[bridge] bearer VERIFY FAIL:", String(e));
    }
  }

  // ---- 2) Cookie path: verify the __session cookie yourself ----
  if (!userId && cookieHeader) {
    try {
      const m = cookieHeader.match(/(?:^|;\s*)__session=([^;]+)/);
      const raw = m?.[1] ? decodeURIComponent(m[1]) : null;
      if (raw) {
        const v = (await verifyToken(raw, {
          secretKey: process.env.CLERK_SECRET_KEY!,
        })) as unknown as {
          sub?: string;
          sid?: string;
          iat?: number;
          exp?: number;
        };
        userId = typeof v.sub === "string" ? v.sub : null;
        sessionId = typeof v.sid === "string" ? v.sid : null;
        source = userId ? "cookie" : source;
        console.log("[bridge] cookie OK", {
          sub_tail: userId?.slice(-6),
          sid_tail: sessionId?.slice(-6),
          iat: v.iat,
          exp: v.exp,
        });
      }
    } catch (e) {
      console.log("[bridge] cookie VERIFY FAIL:", String(e));
    }
  }

  // ---- 3) Last resort: App Router helper (reads cookies) ----
  if (!userId) {
    const a = await auth();
    userId = a.userId ?? null;
    sessionId = a.sessionId ?? null;
    source = userId ? "auth()" : source;
    if (userId) {
      console.log("[bridge] auth() OK", {
        sub_tail: userId.slice(-6),
        sid_tail: sessionId?.slice(-6),
      });
    } else {
      console.log("[bridge] auth() empty");
    }
  }

  const res = NextResponse.json(
    { ok: true, authenticated: Boolean(userId) },
    { status: 200 }
  );
  res.headers.set("Cache-Control", "no-store"); //no-cache header

  res.headers.set("x-bridge-has-bridge-cookie", hasBridgeCookie ? "yes" : "no");
  res.headers.append(
    "Access-Control-Expose-Headers",
    ",x-bridge-has-bridge-cookie"
  );

  // helpful while testing
  res.headers.set("x-bridge-auth", userId ? "yes" : "no");
  res.headers.set("x-bridge-source", source);
  res.headers.set(
    "x-bridge-has-session-cookie",
    hasSessionCookie ? "yes" : "no"
  );
  res.headers.set(
    "x-bridge-has-any-clerk-cookie",
    hasAnyClerkCookie ? "yes" : "no"
  );
  res.headers.append(
    "Access-Control-Expose-Headers",
    "x-bridge-auth,x-bridge-source,x-bridge-has-session-cookie,x-bridge-has-any-clerk-cookie"
  );

  const secure = process.env.NODE_ENV === "production";
  const sameSite = "lax" as const;

  if (userId) {
    const token = await signBridgeToken(
      { uid: userId, sid: sessionId ?? undefined },
      BRIDGE_TTL_S
    );

    res.cookies.set(BRIDGE_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      path: "/",
      maxAge: BRIDGE_TTL_S,
    });
  }

  return withCors(res, req);
}

export async function OPTIONS(req: Request) {
  const res = new NextResponse(null, { status: 204 });
  return withCors(res, req);
}
