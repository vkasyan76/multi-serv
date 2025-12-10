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
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const authedOnce = useRef(false);
  // ✅ one quick retry to avoid waiting up to refreshMs
  const quickRetryRef = useRef(false);

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
      // ✅ if Clerk says signed out, ask server to clear bridge cookie
      const shouldClear = isSignedIn === false;
      const clearQS = shouldClear ? "?clear=1" : "";

      // Don’t fetch/send a token when you’re explicitly clearing
      let token: string | null = null;
      if (!shouldClear) {
        try {
          token =
            (await getToken({ template: "bridge" })) ??
            (await getToken()) ??
            null;
        } catch {
          // ignore
        }
      }

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const targets = onApex
        ? ["/api/auth/bridge", `${proto}//www.${rootHost}/api/auth/bridge`]
        : [
            // ✅ include current-origin first (helps reliability)
            "/api/auth/bridge",
            `${proto}//${rootHost}/api/auth/bridge`,
            `${proto}//www.${rootHost}/api/auth/bridge`,
          ];

      // const results: PromiseSettledResult<BridgeJson>[] =
      //   await Promise.allSettled(
      //     targets.map(async (u) => {
      //       try {
      //         const r = await fetch(u, {
      //           method: "GET",
      //           credentials: "include",
      //           headers,
      //           cache: "no-store",
      //           mode: "cors",
      //           keepalive: true,
      //         });
      //         return (await r.json()) as BridgeJson;
      //       } catch {
      //         return {};
      //       }
      //     })
      //   );

      const results = await Promise.allSettled(
        targets.map(async (u) => {
          try {
            const url = `${u}${clearQS}`; // ✅ USE clearQS
            const r = await fetch(url, {
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

      // Optional but helpful: if we’re signed out, allow future sign-in to refresh again
      if (shouldClear) {
        authedOnce.current = false;
        quickRetryRef.current = false;
      }

      const authed = results
        .filter(isFulfilled)
        .some((r) => r.value?.authenticated === true);

      if (authed && !authedOnce.current) {
        authedOnce.current = true;
        router.refresh(); // server re-fetch sees the new bridge cookie
        return;
      }

      // ✅ If user is signed in but bridge isn't authed yet, do ONE quick retry
      // This prevents “wait until refreshMs” (60s) in dev.
      if (isSignedIn && !authed && !quickRetryRef.current) {
        quickRetryRef.current = true;
        setTimeout(pingOnce, 1200);
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
  }, [isLoaded, isSignedIn, getToken, refreshMs, router]);

  return null;
}

type BridgeResponse = { ok: boolean; authenticated?: boolean; source?: string };

export function useBridge() {
  return useQuery<BridgeResponse>({
    queryKey: ["auth", "bridge"],
    queryFn: async () => {
      const r = await fetch("/api/auth/bridge", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error("Bridge failed");
      return r.json();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
    retry: 0,
  });
}
