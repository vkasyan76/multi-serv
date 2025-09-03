import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { signBridgeToken } from "@/lib/app-auth";
import { BRIDGE_COOKIE } from "@/constants";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN; // no default
const COOKIE_DOMAIN = ROOT ? `.${ROOT}` : undefined;

export async function GET() {
  const { userId, sessionId } = await auth();
  const res = NextResponse.json({ ok: true, authenticated: Boolean(userId) });

  const secure = process.env.NODE_ENV === "production";
  const sameSite = secure ? ("none" as const) : ("lax" as const);

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
  } else {
    res.cookies.set(BRIDGE_COOKIE, "", {
      httpOnly: true,
      secure,
      sameSite,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}
