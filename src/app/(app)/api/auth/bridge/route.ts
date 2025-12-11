// src/app/(app)/api/auth/bridge/route.ts
import { NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";
import { BRIDGE_COOKIE, BRIDGE_COOKIE_OPTS } from "@/constants";
import { signBridgeToken, verifyBridgeToken } from "@/lib/app-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_SECONDS = 90; // Bridge cookie lifetime

function corsHeaders(origin?: string): HeadersInit {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin, // must echo, not '*'
    "Access-Control-Allow-Credentials": "true", // allow cookies
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
    },
  });
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin") ?? undefined;

  // Clerk helper bound to this request (async in your version)
  const a = await auth(); // <-- await
  let userId: string | null = a.userId ?? null;
  let sessionId: string | null = a.sessionId ?? null;
  let source: "auth" | "bearer" | "cookie" | "bridge" | "none" = userId
    ? "auth"
    : "none";

  // 2) If Authorization: Bearer is present, verify it (template "bridge")
  if (!userId) {
    const authz = req.headers.get("authorization") || "";
    const bearer = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
    if (bearer) {
      try {
        const t = (await verifyToken(bearer, {
          secretKey: process.env.CLERK_SECRET_KEY!,
          audience: "bridge",
        })) as { sub?: string; sid?: string };
        if (t?.sub) {
          userId = t.sub;
          sessionId = t.sid || null;
          source = "bearer";
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 3) If still no user, verify the __session cookie manually
  if (!userId) {
    const cookieHeader = req.headers.get("cookie") || "";
    const m = cookieHeader.match(/(?:^|;\s*)__session=([^;]+)/);
    const raw = m?.[1] ? decodeURIComponent(m[1]) : null;
    if (raw) {
      try {
        const t = (await verifyToken(raw, {
          secretKey: process.env.CLERK_SECRET_KEY!,
        })) as { sub?: string; sid?: string };
        if (t?.sub) {
          userId = t.sub;
          sessionId = t.sid || null;
          source = "cookie";
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 4) Fallback to an existing bridge cookie (if present & valid)
  const jar = await nextCookies();
  const existing = jar.get(BRIDGE_COOKIE)?.value;
  if (!userId && existing) {
    try {
      const data = await verifyBridgeToken(existing);
      if (data?.uid) {
        userId = data.uid;
        if (data?.sid && !sessionId) sessionId = data.sid;
        if (userId) source = "bridge";
      }
    } catch {
      /* ignore invalid/expired */
    }
  }

  // Response + CORS
  const res = NextResponse.json(
    { ok: true, authenticated: !!userId, source },
    { headers: corsHeaders(origin) }
  );

  // Set / clear the apex-scoped bridge cookie
  if (userId) {
    const token = await signBridgeToken(
      { uid: userId, sid: sessionId || undefined },
      TTL_SECONDS
    );
    res.cookies.set(BRIDGE_COOKIE, token, {
      ...BRIDGE_COOKIE_OPTS,
      maxAge: TTL_SECONDS,
    });
  } else if (existing) {
    res.cookies.set(BRIDGE_COOKIE, "", {
      ...BRIDGE_COOKIE_OPTS,
      maxAge: 0,
    });
  }

  return res;
}
