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
  const { getToken, isLoaded } = useAuth();
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
  }, [isLoaded, getToken, refreshMs, router]);

  return null;
}

type BridgeResponse = { ok: boolean; authenticated?: boolean; source?: string };

// send the same Bearer token that you already use in pingOnce()
// send bearer to authenticate the user

export function useBridge() {
  const { getToken, isLoaded } = useAuth();

  return useQuery<BridgeResponse>({
    queryKey: ["auth", "bridge"],
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

      const r = await fetch("/api/auth/bridge", {
        credentials: "include",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!r.ok) throw new Error("Bridge failed");
      return r.json();
    },
    staleTime: 60_000,
    retry: 0,
  });
}
