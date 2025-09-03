"use client";

import { useEffect } from "react";

/**
 * Pings /api/auth/bridge to mint/refresh a short-lived HttpOnly cookie
 * (apex-scoped in prod) so tenant subdomains can auth on the server.
 */
export default function BridgeAuth({
  refreshMs = 60_000,
}: {
  refreshMs?: number;
}) {
  useEffect(() => {
    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ""; // "infinisimo.com"
    const host = window.location.hostname;
    const onTenantSubdomain =
      ROOT && host !== ROOT && host.endsWith(`.${ROOT}`);

    const call = async (url: string) => {
      try {
        const r = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          mode: "cors",
        });
        const data = await r.json().catch(() => ({}));
        // Quick console breadcrumbs

        console.log("bridge", {
          url,
          status: r.status,
          auth: data?.authenticated,
        });
        return Boolean(data?.authenticated);
      } catch {
        console.warn("bridge fetch failed", url);
        return false;
      }
    };

    const pingOnce = async () => {
      // 1) try current origin
      const okLocal = await call("/api/auth/bridge");
      if (okLocal || !onTenantSubdomain) return;

      // 2) try apex
      if (ROOT) {
        const okApex = await call(`https://${ROOT}/api/auth/bridge`);
        if (okApex) return;

        // 3) try www.apex (in case you're signed in there)
        const okWWW = await call(`https://www.${ROOT}/api/auth/bridge`);
        if (okWWW) return;
      }
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
  }, [refreshMs]);

  return null;
}
