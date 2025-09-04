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
  const { getToken, isLoaded } = useAuth();

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

    const call = async (url: string) => {
      try {
        // get a short-lived Clerk session token (default template is fine)
        const jwt = isLoaded ? await getToken().catch(() => null) : null;

        const r = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          mode: "cors",
          headers: jwt ? { authorization: `Bearer ${jwt}` } : undefined,
        });

        const data = await r.json().catch(() => ({}));

        console.debug("[BridgeAuth] bridge", {
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
      // try apex first (where Clerk session lives)
      if (ROOT && (await call(`https://${ROOT}/api/auth/bridge`))) return;
      if (ROOT && (await call(`https://www.${ROOT}/api/auth/bridge`))) return;

      // finally local host
      await call("/api/auth/bridge");
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
  }, [refreshMs, getToken, isLoaded]); // ✅ include getToken and isLoaded

  return null;
}
