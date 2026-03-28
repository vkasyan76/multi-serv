"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export const AuthCacheSync = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const wasSignedInRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    const sessionKey = trpc.auth.session.queryOptions().queryKey;
    const profileKey = trpc.auth.getUserProfile.queryOptions().queryKey;
    const mineTenantKey = trpc.tenants.getMine.queryOptions({}).queryKey;
    const hasOrdersKey =
      trpc.orders.hasAnyMineSlotLifecycle.queryOptions().queryKey;

    // Clear only user-scoped cache after a real signed-in -> signed-out transition.
    if (wasSignedInRef.current && !isSignedIn) {
      void (async () => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: sessionKey }),
          queryClient.cancelQueries({ queryKey: profileKey }),
          queryClient.cancelQueries({ queryKey: mineTenantKey }),
          queryClient.cancelQueries({ queryKey: hasOrdersKey }),
        ]);

        queryClient.removeQueries({ queryKey: sessionKey });
        queryClient.removeQueries({ queryKey: profileKey });
        queryClient.removeQueries({ queryKey: mineTenantKey });
        queryClient.removeQueries({ queryKey: hasOrdersKey });
      })();
    }

    wasSignedInRef.current = isSignedIn;
  }, [isLoaded, isSignedIn, queryClient, trpc]);

  return null;
};
