"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

import { useBridge } from "@/modules/tenants/ui/components/tenant_page/BridgeAuth";
import {
  type AppLang,
  normalizeToSupported,
  getInitialLanguage,
} from "@/modules/profile/location-utils";

type BridgeResponse = {
  ok: boolean;
  authenticated?: boolean;
  source?: string;
  uid?: string | null;
  sid?: string | null;
};

type Options = {
  maxMs?: number; // Step 3: total warmup window
  stepMs?: number; // Step 3: poll cadence
  allowOneReload?: boolean; // Step 3: optional “one early hard reload”
};

export function useTenantAuth(slug: string, opts: Options = {}) {
  const { maxMs = 2000, stepMs = 250, allowOneReload = true } = opts;

  const trpc = useTRPC();

  // Step 1) Bridge check:
  // - Talks to /api/auth/bridge (apex) and returns { ok, authenticated, ... }
  // - This is what tells us whether the bridge cookie/session is ready.
  const {
    data: bridge,
    isLoading: bridgeLoading,
    isFetching: bridgeFetching,
    refetch: refetchBridge,
  } = useBridge();

  // Step 2) Payload-backed proof:
  // - Only run when the bridge says authenticated === true.
  // - This confirms your backend (Payload) sees the same signed-in user.
  const profileQ = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: (bridge as BridgeResponse | undefined)?.authenticated === true,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  // Step 2a) Destructure values we actually use.
  // This avoids referencing `profileQ` directly inside effects (lint-friendly).
  const profileData = profileQ.data;
  const profileRefetch = profileQ.refetch;
  const profileIsError = profileQ.isError;

  // Auth identity marker:
  // - authenticated is always present
  // - uid/sid are present in non-prod (debug), but safely empty in prod
  // - profileData?.id is your Payload-backed identity proof
  const authIdentityKey = useMemo(() => {
    const b = bridge as BridgeResponse | undefined;

    if (!b?.ok) return "bridge:not-ok";

    const authed =
      b.authenticated === true ? "1" : b.authenticated === false ? "0" : "u";

    // Only attach identity when authed; avoids stale profile id during signed-out phases
    const uid = b.authenticated === true ? (b.uid ?? "") : "";
    const sid = b.authenticated === true ? (b.sid ?? "") : "";
    const pid = b.authenticated === true ? (profileData?.id ?? "") : "";

    return `${authed}:${uid}:${sid}:${pid}`;
  }, [bridge, profileData?.id]);

  // Step 3) Warmup gate:
  // Goal: right after fast logout->login, give the bridge/profile a short window
  // to converge to the "real" signed-in state before we render tenant content.
  const [warmReady, setWarmReady] = useState(false);

  // Internal refs to avoid loops / repeated reloads
  const warmDoneRef = useRef(false);
  const warmStartRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const reloadedRef = useRef(false);

  const warmIdentityRef = useRef<string | null>(null); // ref to remember the identity used when warmup completed

  // Step 3a) Detect if we already performed the one-time reload for this slug.
  // This prevents infinite reload loops.
  useEffect(() => {
    const raw = sessionStorage.getItem("bridgeWarmReload");
    if (!raw) return;

    try {
      const d = JSON.parse(raw) as { slug: string; ts: number };
      if (d.slug === slug && Date.now() - d.ts < 15_000) {
        reloadedRef.current = true;
      }
    } catch {
      // ignore malformed value
    } finally {
      sessionStorage.removeItem("bridgeWarmReload");
    }
  }, [slug]);

  // Step 3b) Warmup loop:
  // - If bridge says signed out, briefly poll in case it flips to authed.
  // - If bridge says authed, require profileData as proof.
  // - If it doesn't converge quickly, optionally do ONE early reload, then stop blocking.
  useEffect(() => {
    if (warmDoneRef.current) return;

    // If subdomain routing is off, there is no cross-domain bridge race worth gating for.
    if (process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING !== "true") {
      warmDoneRef.current = true;
      setWarmReady(true);
      return;
    }

    // Clear any pending timer before scheduling a new one.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const b = bridge as BridgeResponse | undefined;

    // Wait until the bridge query has a definitive response.
    if (!b?.ok) return;

    // Start warm timer once (only after bridge ok).
    if (warmStartRef.current === null) warmStartRef.current = Date.now();
    const elapsed = Date.now() - warmStartRef.current;

    const finish = () => {
      warmDoneRef.current = true;
      warmIdentityRef.current = authIdentityKey; // <-- NEW: remember identity when warmup finished
      setWarmReady(true);
    };

    // Case A) Bridge says signed out:
    // Give a short chance to flip to authed (cookie/token race).
    if (b.authenticated === false) {
      if (elapsed >= maxMs) return finish();

      timerRef.current = window.setTimeout(() => {
        refetchBridge();
      }, stepMs);

      return;
    }

    // Case B) Bridge says authed:
    // Require payload-backed proof (profileData) before declaring warmReady.
    if (profileData) return finish();

    // If we waited too long, optionally do ONE early reload (once), then stop blocking.
    if (elapsed >= maxMs) {
      if (allowOneReload && !reloadedRef.current) {
        reloadedRef.current = true;
        sessionStorage.setItem(
          "bridgeWarmReload",
          JSON.stringify({ slug, ts: Date.now() })
        );
        window.location.reload();
        return;
      }

      return finish();
    }

    // Continue polling briefly.
    timerRef.current = window.setTimeout(async () => {
      await refetchBridge();
      await profileRefetch();
    }, stepMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    bridge,
    refetchBridge,
    profileData,
    profileRefetch,
    slug,
    maxMs,
    stepMs,
    allowOneReload,
    authIdentityKey,
  ]);

  // new effect after the warmup loop effect to reset warmup on identity change:

  // Reset warmup if auth identity changes without a remount (e.g., fast logout -> login as another user).
  useEffect(() => {
    // If subdomain routing is disabled, there is no cross-domain bridge race to manage.
    if (process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING !== "true") return;

    // Only react AFTER we have completed a warmup at least once.
    if (!warmDoneRef.current) return;

    const prev = warmIdentityRef.current;
    if (!prev) return;

    if (prev === authIdentityKey) return;

    // Auth identity changed -> rerun warmup gate to avoid stale "ready" state across users.
    warmDoneRef.current = false;
    warmStartRef.current = null;
    setWarmReady(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Do NOT touch reloadedRef; your sessionStorage guard still prevents reload loops.
    // warmIdentityRef will be updated again when warmup finishes.
  }, [authIdentityKey]);

  // Step 4) Derive auth state for UI (tri-state):
  // - false: bridge definitively says signed out
  // - true: bridge says authed AND profile proof exists
  // - null: “still resolving” (prevents false negatives)
  const signedState: boolean | null = useMemo(() => {
    const b = bridge as BridgeResponse | undefined;
    if (!b?.ok) return null;

    if (b.authenticated === false) return false;

    if (profileIsError) return null;
    if (profileData) return true;

    return null;
  }, [bridge, profileData, profileIsError]);

  // Step 5) Stable viewer key for resetting downstream UI when the auth user changes.
  const viewerKey = signedState === true ? (profileData?.id ?? null) : null;

  // Step 6) App language derived from profile (fallback to browser/device).
  const appLang: AppLang = useMemo(() => {
    const profileLang = profileData?.language;
    if (profileLang) return normalizeToSupported(profileLang);
    return getInitialLanguage();
  }, [profileData?.language]);

  // Step 7) Single “gate” boolean for tenant page rendering.
  const waitingForAuth =
    bridgeLoading ||
    bridgeFetching ||
    !(bridge as BridgeResponse | undefined)?.ok ||
    !warmReady;

  // Step 8) One-shot resync hook (used by ConversationSheet safety net).
  // keeps your “no hard reload” strategy, but makes the “retry once” actually retry with the backend being ready.
  const onBridgeResync = async () => {
    const res = await refetchBridge();
    if (!(res.data?.ok === true && res.data?.authenticated === true))
      return false;

    const prof = await profileRefetch();
    return !!prof.data;
  };

  return {
    bridge: bridge as BridgeResponse | undefined,
    signedState,
    viewerKey,
    appLang,
    warmReady,
    waitingForAuth,
    onBridgeResync,
    // (Optional) expose for debugging; you can remove later if you want:
    profileQ,
  };
}
