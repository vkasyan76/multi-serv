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
    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN!; // e.g. "infinisimo.com"

    const pingOnce = async () => {
      try {
        // 1) try local subdomain first
        const r = await fetch("/api/auth/bridge", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await r.json().catch(() => ({}));

        // 2) if not authenticated AND we're on a tenant subdomain, call APEX bridge
        const host = window.location.hostname;
        const onTenantSubdomain =
          ROOT && host !== ROOT && host.endsWith(`.${ROOT}`);

        if (!data?.authenticated && onTenantSubdomain) {
          await fetch(`https://${ROOT}/api/auth/bridge`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            // CORS with credentials: server must echo our Origin (below)
            mode: "cors",
          }).catch(() => {});
        }
      } catch {}
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
