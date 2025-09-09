// src/trpc/auth-utils.ts
import { cookies as nextCookies } from "next/headers";
import { BRIDGE_COOKIE } from "@/constants";
import { verifyBridgeToken } from "@/lib/app-auth";

/**
 * Reads the bridged user id (uid) from the bridge cookie (inf_br).
 * Works both with an incoming Request (API route) and in app-router (next/headers).
 * Returns: string | null
 */
export async function readBridgeUidFromRequest(
  req?: Request
): Promise<string | null> {
  try {
    // Fast path: if we’re inside a route handler with a Request, read the Cookie header directly.
    if (req) {
      const cookieHeader = req.headers.get("cookie") ?? "";
      const m = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${BRIDGE_COOKIE}=([^;]+)`)
      );
      const token = m?.[1] ?? null;
      if (token) {
        const { uid } = await verifyBridgeToken(token);
        return typeof uid === "string" && uid.length > 0 ? uid : null;
      }
      return null;
    }

    // App Router path (no Request provided): use next/headers cookies()
    const store = await nextCookies();
    const token = store.get(BRIDGE_COOKIE)?.value;
    if (token) {
      const { uid } = await verifyBridgeToken(token);
      return typeof uid === "string" && uid.length > 0 ? uid : null;
    }
  } catch {
    // swallow — treat as anonymous
  }
  return null;
}
