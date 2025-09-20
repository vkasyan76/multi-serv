"use client";

import { Button } from "@/components/ui/button";
import { useCart } from "@/modules/checkout/hooks/use-cart";

export function CartButton({ tenantSlug }: { tenantSlug: string }) {
  const { totalItems, openCart } = useCart(tenantSlug);

  return (
    <Button onClick={openCart} variant="secondary" className="min-w-[150px]">
      {totalItems ? `Open cart (${totalItems})` : "Open cart"}
    </Button>
  );
}
