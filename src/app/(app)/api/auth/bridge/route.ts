import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { signBridgeToken } from "@/lib/app-auth";
import { BRIDGE_COOKIE } from "@/constants";

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
  }
  return res;
}

export async function GET(req: Request) {
  const { userId, sessionId } = await auth();

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
