"use client";

import { Button } from "@/components/ui/button";
import { useCart } from "@/modules/checkout/hooks/use-cart";
import { useTranslations } from "next-intl";

export function CartButton({ tenantSlug }: { tenantSlug: string }) {
  const { totalItems, openCart } = useCart(tenantSlug);
  const tCheckout = useTranslations("checkout");

  return (
    <Button onClick={openCart} variant="secondary" className="min-w-[150px]">
      {totalItems
        ? tCheckout("cart.open_count", { count: totalItems })
        : tCheckout("cart.open")}
    </Button>
  );
}