"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Pings /api/auth/bridge to mint/refresh a short-lived HttpOnly cookie
 * (apex-scoped in prod) so tenant subdomains can auth on the server.
 */
export default function BridgeAuth({
  refreshMs = 60_000,
}: {
  refreshMs?: number;
}) {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;
    const host = window.location.hostname;
    const onApex = host === ROOT || host === `www.${ROOT}`;
    const urls = [
      `https://${ROOT}/api/auth/bridge`,
      `https://www.${ROOT}/api/auth/bridge`,
    ];

    const pingOnce = async () => {
      let token: string | null = null;
      try {
        // try a scoped template if you have one; otherwise plain getToken()
        token = (await getToken({ template: "bridge" })) ?? null;
      } catch {
        token = null;
      }

      if (!token) {
        console.warn(
          "[BridgeAuth] getToken() returned null — sending request WITHOUT Authorization (may fail)"
        );
      }

      // If we're on a tenant subdomain and Clerk can't give us a token,
      // don't ping the apex — it can cause the bridge cookie to be cleared.
      if (!onApex && !token) {
        console.warn("[BridgeAuth] no token on subdomain — skipping apex ping");
        return;
      }

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      await Promise.allSettled(
        urls.map((u) =>
          fetch(u, {
            method: "GET",
            credentials: "include", // send cookies to apex
            headers,
            cache: "no-store",
            mode: "cors",
          })
            .then((r) => r.json().catch(() => ({})))
            .then((j) => console.log("[BridgeAuth] bridge", u, j))
            .catch((e) => console.error("[BridgeAuth] bridge error", u, e))
        )
      );
    };

    // initial + keepalive + on tab focus
    pingOnce();
    const id = setInterval(pingOnce, refreshMs);
    const onVis = () => document.visibilityState === "visible" && pingOnce();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isLoaded, getToken, refreshMs]);

  return null;
}
