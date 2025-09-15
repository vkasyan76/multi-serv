"use client";

import { Button } from "@/components/ui/button";
// keep your existing hook path
import { useCart } from "@/modules/checkout/hooks/use-cart";
import {
  slotToCartItem,
  type CartItem,
} from "@/modules/checkout/store/use-cart-store";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  tenantSlug: string;
  selectedIds: string[];
  /** e.g. 15 €/h -> 1500 */
  pricePerHourCents: number;
  onAdded?: () => void;
};

// Tiny helpers to make TS happy and avoid `any`
type BookingLite = { id: string; start: string; end: string };
type MaybeBookings = BookingLite[] | { items?: BookingLite[] } | undefined;

function toBookingsArray(data: MaybeBookings): BookingLite[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(isBookingLite);
  if (Array.isArray(data.items)) return data.items.filter(isBookingLite);
  return [];
}
function isBookingLite(x: unknown): x is BookingLite {
  return (
    !!x && typeof x === "object" && "id" in x && "start" in x && "end" in x
  );
}

export function BookSlotsButton({
  tenantSlug,
  selectedIds,
  pricePerHourCents,
  onAdded,
}: Props) {
  const { addSelected, openCart } = useCart(tenantSlug);
  const qc = useQueryClient();

  // Build an index of id -> {start,end} from ALL bookings queries in cache
  const slotIndex = useMemo(() => {
    const index = new Map<string, { start: string; end: string }>();
    const snaps = qc.getQueriesData<MaybeBookings>({
      predicate: (q) => {
        const s = JSON.stringify(q.queryKey ?? []);
        return (
          s.includes('"bookings"') &&
          (s.includes('"listPublicSlots"') || s.includes('"listMine"'))
        );
      },
    });

    for (const [, data] of snaps) {
      for (const b of toBookingsArray(data)) {
        index.set(String(b.id), { start: String(b.start), end: String(b.end) });
      }
    }
    return index;
  }, [qc]);

  const onClick = () => {
    if (!selectedIds.length) return;

    const items: CartItem[] = [];
    for (const id of selectedIds) {
      const s = slotIndex.get(id);
      if (!s) continue; // not in cache → skip quietly for now
      items.push(
        slotToCartItem({ id, start: s.start, end: s.end }, pricePerHourCents)
      );
    }

    const ok = addSelected(items);
    if (ok) {
      onAdded?.(); // clear selection if you passed it
      openCart();
    }
  };

  return (
    <Button
      disabled={!selectedIds.length}
      onClick={onClick}
      className="px-4 py-2"
    >
      {selectedIds.length ? `Book slots (${selectedIds.length})` : "Book slots"}
    </Button>
  );
}
