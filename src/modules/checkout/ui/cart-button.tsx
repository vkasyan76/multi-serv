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

// For now you don’t have start/end in selected—only IDs—so keep the working Cart button above. When you expose the slot details from the calendar or via a small query, we’ll swap the “Book selected” button for this “Add selected to cart” button.

// import { Button } from "@/components/ui/button";
// import { useCart } from "@/modules/checkout/store/hooks/use-cart";
// import {
//   slotToCartItem,
//   CartItem,
// } from "@/modules/checkout/store/use-cart-store";

// type MinimalSlot = { id: string; start: string; end: string };

// export function AddSelectedToCartButton({
//   tenantSlug,
//   selectedSlots, // [{ id, start, end }]
//   pricePerHourCents, // e.g. Math.round(hourlyRate * 100)
// }: {
//   tenantSlug: string;
//   selectedSlots: MinimalSlot[];
//   pricePerHourCents: number;
// }) {
//   const { addSelected, openCart } = useCart(tenantSlug);

//   const onClick = () => {
//     const items: CartItem[] = selectedSlots.map((s) =>
//       slotToCartItem(
//         { id: s.id, start: s.start, end: s.end },
//         pricePerHourCents
//       )
//     );
//     const ok = addSelected(items);
//     if (ok) openCart();
//   };

//   return (
//     <Button disabled={!selectedSlots.length} onClick={onClick}>
//       {selectedSlots.length
//         ? `Add selected (${selectedSlots.length})`
//         : "Add selected"}
//     </Button>
//   );
// }
