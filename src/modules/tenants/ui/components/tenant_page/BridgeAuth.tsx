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
    const ping = () =>
      fetch("/api/auth/bridge", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => {});

    // initial + keepalive + on tab focus
    ping();
    const id = setInterval(ping, refreshMs);
    const onVis = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshMs]);

  return null;
}
