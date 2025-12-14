"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

type BridgeJson = {
  ok?: boolean;
  authenticated?: boolean;
  [k: string]: unknown;
};
const isFulfilled = <T,>(
  r: PromiseSettledResult<T>
): r is PromiseFulfilledResult<T> => r.status === "fulfilled";

export default function BridgeAuth({
  refreshMs = 60_000,
}: {
  refreshMs?: number;
}) {
  const { getToken, isLoaded, userId } = useAuth();
  const router = useRouter();
  const authedOnce = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;
    const rootHost = ROOT.replace(/^https?:\/\//, "");
    const pageHost = window.location.host;
    const onApex = pageHost === rootHost || pageHost === `www.${rootHost}`;
    const isLocalRoot = /(^|\.)(localhost|127\.0\.0\.1|\[::1\])(:(\d+))?$/.test(
      rootHost
    );

    const proto = isLocalRoot ? window.location.protocol : "https:";

    const pingOnce = async () => {
      let token: string | null = null;
      try {
        token =
          (await getToken({ template: "bridge" })) ??
          (await getToken()) ??
          null;
      } catch {
        // ignore
      }

      const targets = onApex
        ? ["/api/auth/bridge", `${proto}//www.${rootHost}/api/auth/bridge`]
        : [
            `${proto}//${rootHost}/api/auth/bridge`,
            `${proto}//www.${rootHost}/api/auth/bridge`,
          ];

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const results: PromiseSettledResult<BridgeJson>[] =
        await Promise.allSettled(
          targets.map(async (u) => {
            try {
              const r = await fetch(u, {
                method: "GET",
                credentials: "include",
                headers,
                cache: "no-store",
                mode: "cors",
                keepalive: true,
              });
              return (await r.json()) as BridgeJson;
            } catch {
              return {};
            }
          })
        );

      const authed = results
        .filter(isFulfilled)
        .some((r) => r.value?.authenticated === true);

      if (!authed) {
        authedOnce.current = false; // allow refresh on next login
      }

      if (authed && !authedOnce.current) {
        authedOnce.current = true;
        router.refresh(); // server re-fetch sees the new bridge cookie
      }
    };

    pingOnce();
    const id = setInterval(pingOnce, refreshMs);
    const onVis = () => document.visibilityState === "visible" && pingOnce();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isLoaded, getToken, refreshMs, router, userId]); // include user Id in the dependency: tear down + recreate the interval and visibility handler on login/logout

  return null;
}

type BridgeResponse = {
  ok: boolean;
  authenticated?: boolean;
  source?: string;
  uid?: string | null;
  sid?: string | null;
};

// send the same Bearer token that you already use in pingOnce()
// send bearer to authenticate the user

export function useBridge() {
  const { getToken, isLoaded, userId } = useAuth();

  return useQuery<BridgeResponse>({
    // queryKey: ["auth", "bridge"],
    queryKey: ["auth", "bridge", userId ?? "anon"], // IMPORTANT: bust cache on login/logout
    enabled: isLoaded,
    queryFn: async () => {
      let token: string | null = null;

      try {
        token =
          (await getToken({ template: "bridge" })) ??
          (await getToken()) ??
          null;
      } catch {
        // ignore
      }

      // const r = await fetch("/api/auth/bridge", {
      //   credentials: "include",
      //   cache: "no-store",
      //   headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      // });

      const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;
      const rootHost = ROOT.replace(/^https?:\/\//, "");
      const pageHost = window.location.host;
      const onApex = pageHost === rootHost || pageHost === `www.${rootHost}`;
      const isLocalRoot =
        /(^|\.)(localhost|127\.0\.0\.1|\[::1\])(:(\d+))?$/.test(rootHost);

      const proto = isLocalRoot ? window.location.protocol : "https:";

      // Critical: when on a tenant subdomain, call the APEX bridge endpoint
      // so it can read the apex Clerk session and mint the shared bridge cookie.
      const url = onApex
        ? "/api/auth/bridge"
        : `${proto}//${rootHost}/api/auth/bridge`;

      const r = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        mode: onApex ? "same-origin" : "cors",
        keepalive: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!r.ok) throw new Error("Bridge failed");
      return r.json();
    },
    // IMPORTANT: do not “stick” to a bad first answer for 60s
    // staleTime: 60_000,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    // refetchOnWindowFocus: false,
    refetchOnWindowFocus: true,
    retry: 0,
  });
}
