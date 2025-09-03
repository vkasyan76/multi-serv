import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { signBridgeToken } from "@/lib/app-auth";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "infinisimo.com";
const COOKIE = "inf_br";

export async function GET() {
  const { userId, sessionId } = await auth(); // await fixes TS type

  const res = NextResponse.json({ ok: true, authenticated: Boolean(userId) });

  const secure = process.env.NODE_ENV === "production";
  const sameSite = secure ? ("none" as const) : ("lax" as const);

  if (userId) {
    const token = await signBridgeToken(
      { uid: userId, sid: sessionId ?? undefined },
      120
    );
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite,
      domain: `.${ROOT}`,
      path: "/",
      maxAge: 120,
    });
  } else {
    // Clear cookie if not authenticated
    res.cookies.set(COOKIE, "", {
      httpOnly: true,
      secure,
      sameSite,
      domain: `.${ROOT}`,
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}
