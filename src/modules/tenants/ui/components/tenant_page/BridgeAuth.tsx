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
  // ✅ call the hook at the top level
  const { getToken } = useAuth();

  useEffect(() => {
    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ""; // "infinisimo.com"
    const host = window.location.hostname;
    const onTenantSubdomain =
      ROOT && host !== ROOT && host.endsWith(`.${ROOT}`);

    console.log("[BridgeAuth debug]", {
      ROOT,
      host,
      onTenantSubdomain,
    });

    const call = async (url: string, bearer?: string | null) => {
      try {
        const r = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          mode: "cors",
          headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
        });
        const data = await r.json().catch(() => ({}));
        console.log("bridge", { url, status: r.status, auth: data?.authenticated });
        return Boolean(data?.authenticated);
      } catch {
        console.warn("bridge fetch failed", url);
        return false;
      }
    };

    const pingOnce = async () => {
      const bearer = (await getToken().catch(() => null)) ?? null;

      // try apex first (where Clerk session lives)
      if (ROOT && (await call(`https://${ROOT}/api/auth/bridge`, bearer))) return;
      if (ROOT && (await call(`https://www.${ROOT}/api/auth/bridge`, bearer))) return;

      // finally local host
      await call("/api/auth/bridge", bearer);
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
  }, [refreshMs, getToken]); // ✅ include getToken

  return null;
}
