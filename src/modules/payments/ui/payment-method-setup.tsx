// src/modules/payments/ui/payment-method-setup.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/modules/checkout/store/use-cart-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const PM_CART_KEY = "pm_cart_restore_v1";

type Props = {
  tenantId: string;
  tenantName?: string | null;
  className?: string;
};

export function PaymentMethodSetup({ tenantId, tenantName, className }: Props) {
  const tCheckout = useTranslations("checkout");
  const [finalizing, setFinalizing] = useState(false);
  const finalizedRef = useRef(false);

  const qc = useQueryClient();

  const trpc = useTRPC();
  const router = useRouter();
  const sp = useSearchParams();

  const profileOpts = trpc.payments.getOrCreateProfileForTenant.queryOptions({
    tenantId,
  });
  const profileQ = useQuery(profileOpts);

  const createSetupSession = useMutation({
    ...trpc.payments.createSetupSession.mutationOptions(),
    retry: false,
  });

  const finalizeSetup = useMutation({
    ...trpc.payments.finalizeSetupFromSession.mutationOptions(),
    retry: false,
  });

  const setupFlag = sp.get("pm_setup");
  const sessionId = sp.get("session_id");

  const status = profileQ.data?.status ?? "none";
  const cardBrand = profileQ.data?.cardBrand ?? null;
  const cardLast4 = profileQ.data?.cardLast4 ?? null;

  const cardOnFile = status === "active";
  const provider = tenantName?.trim() ? tenantName.trim() : null;

  const showFinalizing = finalizing || (setupFlag === "success" && !!sessionId);

  const titleText = showFinalizing
    ? tCheckout("payment_method.saving")
    : cardOnFile
      ? provider
        ? tCheckout("payment_method.payment_method_for_provider", { provider })
        : tCheckout("payment_method.update_payment_method")
      : provider
        ? tCheckout("payment_method.add_payment_method_for_provider", { provider })
        : tCheckout("payment_method.add_payment_method");

  const buttonText = showFinalizing
    ? tCheckout("payment_method.saving")
    : cardOnFile
      ? tCheckout("payment_method.update_payment_method")
      : tCheckout("payment_method.add_payment_method");

  const busy =
    showFinalizing ||
    profileQ.isPending ||
    createSetupSession.isPending ||
    finalizeSetup.isPending;

  useEffect(() => {
    if (!setupFlag) return;

    if (setupFlag === "cancel") {
      const url = new URL(window.location.href);
      url.searchParams.delete("pm_setup");
      url.searchParams.delete("session_id");
      router.replace(url.pathname + (url.search ? url.search : ""));
      toast.message(tCheckout("payment_method.card_setup_canceled"));

      finalizedRef.current = false;
      setFinalizing(false);
      return;
    }

    if (setupFlag !== "success" || !sessionId) return;
    if (finalizeSetup.isPending) return;
    if (finalizedRef.current) return;

    finalizedRef.current = true;
    setFinalizing(true);

    (async () => {
      try {
        await qc.cancelQueries({ queryKey: profileOpts.queryKey });

        const updated = await finalizeSetup.mutateAsync({
          tenantId,
          sessionId,
        });
        qc.setQueryData(profileOpts.queryKey, updated);

        const url = new URL(window.location.href);
        url.searchParams.delete("pm_setup");
        url.searchParams.delete("session_id");
        router.replace(url.pathname + (url.search ? url.search : ""));

        toast.success(tCheckout("payment_method.card_saved"));
      } catch {
        finalizedRef.current = false;
        toast.error(tCheckout("payment_method.card_setup_finalize_failed"));
      } finally {
        setFinalizing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupFlag, sessionId]);

  const startSetup = async () => {
    try {
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
        // ignore
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("pm_setup");
      url.searchParams.delete("session_id");

      const returnTo = url.pathname + (url.search ? url.search : "");

      const res = await createSetupSession.mutateAsync({ tenantId, returnTo });
      if (!res?.url) throw new Error("No Stripe URL returned.");
      window.location.assign(res.url);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tCheckout("payment_method.start_setup_failed")
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
              {cardBrand
                ? `${cardBrand} **** ${cardLast4 ?? "-"}`
                : `**** ${cardLast4 ?? "-"}`}
            </div>
          ) : null}
        </div>

        <Button onClick={startSetup} disabled={busy}>
          {buttonText}
        </Button>

        <div className="text-xs text-muted-foreground">
          {tCheckout("payment_method.no_charge_at_booking")}
        </div>
      </CardContent>
    </Card>
  );
}