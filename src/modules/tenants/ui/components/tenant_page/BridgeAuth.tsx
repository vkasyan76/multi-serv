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

    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN!; // e.g. "infinisimo.com" or "localhost:3000"
    const rootHost = ROOT.replace(/^https?:\/\//, ""); // normalize
    const pageHost = window.location.host; // includes port (e.g. "localhost:3000")
    const onApex = pageHost === rootHost || pageHost === `www.${rootHost}`;

    // Use https in prod, mirror the current page protocol for localhost
    const isLocalRoot = /(^|\.)(localhost|127\.0\.0\.1|\[::1\])(:(\d+))?$/.test(
      rootHost
    );

    const proto = isLocalRoot ? window.location.protocol : "https:";

    const pingOnce = async () => {
      let token: string | null = null;
      try {
        // try a scoped template if you have one; otherwise plain getToken()
        token = (await getToken({ template: "bridge" })) ?? null;
        if (!token) token = (await getToken()) ?? null; // ← fallback to default session JWT
      } catch {
        token = null;
      }

      if (!token) {
        console.warn(
          "[BridgeAuth] getToken() returned null — sending request WITHOUT Authorization (may fail)"
        );
      }

      // Always ping apex from tenants; only use local when we *are* on the apex.
      const targets = onApex
        ? ["/api/auth/bridge", `${proto}//www.${rootHost}/api/auth/bridge`]
        : [
            `${proto}//${rootHost}/api/auth/bridge`,
            `${proto}//www.${rootHost}/api/auth/bridge`,
          ];

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      await Promise.allSettled(
        targets.map((u) =>
          fetch(u, {
            method: "GET",
            credentials: "include", // send cookies to apex
            headers,
            cache: "no-store",
            mode: "cors",
            keepalive: true, // optional improve reliability when the tab closes or navigates.
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
