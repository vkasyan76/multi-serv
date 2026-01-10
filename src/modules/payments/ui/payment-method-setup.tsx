// src/modules/payments/ui/payment-method-setup.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/modules/checkout/store/use-cart-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

//  restore cart atomically (used after Stripe redirect)
const PM_CART_KEY = "pm_cart_restore_v1";

type Props = {
  tenantId: string;
  tenantName?: string | null;
  className?: string;
};

export function PaymentMethodSetup({ tenantId, tenantName, className }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const sp = useSearchParams();

  const profileQ = useQuery(
    trpc.payments.getOrCreateProfileForTenant.queryOptions({ tenantId })
  );

  const createSetupSession = useMutation({
    ...trpc.payments.createSetupSession.mutationOptions(),
    retry: false,
  });

  const finalizeSetup = useMutation({
    ...trpc.payments.finalizeSetupFromSession.mutationOptions(),
    retry: false,
  });

  const status = profileQ.data?.status ?? "none";
  const cardBrand = profileQ.data?.cardBrand ?? null;
  const cardLast4 = profileQ.data?.cardLast4 ?? null;

  const cardOnFile = status === "active";
  const provider = tenantName?.trim() ? tenantName.trim() : "this provider";

  const titleText = cardOnFile
    ? `Payment method for ${provider}`
    : `Add a payment method for ${provider} to continue`;

  const buttonText = cardOnFile
    ? "Update payment method"
    : "Add payment method";

  const busy =
    profileQ.isPending ||
    createSetupSession.isPending ||
    finalizeSetup.isPending;

  const setupFlag = sp.get("pm_setup");
  // "success" | "cancel" | null
  const sessionId = sp.get("session_id");

  useEffect(() => {
    if (!setupFlag) return;
    // clean params and toast, if if you land on pm_setup=cancel.
    if (setupFlag === "cancel") {
      const url = new URL(window.location.href);
      url.searchParams.delete("pm_setup");
      url.searchParams.delete("session_id");
      router.replace(url.pathname + (url.search ? url.search : ""));
      toast.message("Card setup canceled.");
      return;
    }

    if (setupFlag !== "success" || !sessionId) return;
    if (finalizeSetup.isPending) return;

    (async () => {
      try {
        await finalizeSetup.mutateAsync({ tenantId, sessionId });
        await profileQ.refetch();

        // clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete("pm_setup");
        url.searchParams.delete("session_id");

        router.replace(url.pathname + (url.search ? url.search : ""));

        toast.success("Card saved.");
      } catch {
        toast.error("Could not finalize card setup.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupFlag, sessionId]);

  const startSetup = async () => {
    try {
      // ✅ snapshot the cart BEFORE leaving the site (Stripe redirect = full reload)
      try {
        const cartTenantSlug = useCartStore.getState().tenant;
        const cartItems = useCartStore.getState().items;

        if (cartTenantSlug && cartItems.length > 0) {
          sessionStorage.setItem(
            PM_CART_KEY,
            JSON.stringify({
              tenantSlug: cartTenantSlug,
              items: cartItems,
              ts: Date.now(),
            })
          );
        }
      } catch {
        // ignore (best-effort only)
      }

      // Build a clean "returnTo" (relative path) from the CURRENT page
      const url = new URL(window.location.href);
      url.searchParams.delete("pm_setup");
      url.searchParams.delete("session_id");

      const returnTo = url.pathname + (url.search ? url.search : "");

      const res = await createSetupSession.mutateAsync({ tenantId, returnTo });
      if (!res?.url) throw new Error("No Stripe URL returned.");
      window.location.assign(res.url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start setup."
      );
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-2">
        <div className="text-sm">
          <div className={cardOnFile ? "" : "font-medium"}>{titleText}</div>

          {cardOnFile && (cardBrand || cardLast4) ? (
            <div className="text-muted-foreground">
              {cardBrand ?? "Card"} •••• {cardLast4 ?? "—"}
            </div>
          ) : null}
        </div>

        <Button onClick={startSetup} disabled={busy}>
          {buttonText}
        </Button>

        {/* DEV copy matching your target flow */}
        <div className="text-xs text-muted-foreground">
          You won’t be charged unless you accept the completed service.
        </div>
      </CardContent>
    </Card>
  );
}
