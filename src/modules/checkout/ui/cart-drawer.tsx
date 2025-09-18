"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/modules/checkout/store/use-cart-store";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BOOKING_CH } from "@/constants";
import { TRPCClientError } from "@trpc/client";

const EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function CartDrawer() {
  const open = useCartStore((s) => s.open);
  const setOpen = useCartStore((s) => s.setOpen);
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);

  const tenantSlug = useCartStore((s) => s.tenant);

  const totalCents = items.reduce((sum, it) => sum + (it.priceCents ?? 0), 0);

  const trpc = useTRPC();
  const qc = useQueryClient();

  // invalidate all bookings lists (public + mine)
  const invalidateBookings = () =>
    qc.invalidateQueries({
      predicate: (q) => {
        const s = JSON.stringify(q.queryKey ?? []);
        return (
          s.includes('"bookings"') &&
          (s.includes('"listPublicSlots"') || s.includes('"listMine"'))
        );
      },
    });

  // calendar listeners filter by channel + tenant; including tenantSlug and ids makes cross-tab refresh precise.
  const bookSlots = useMutation({
    ...trpc.bookings.bookSlots.mutationOptions(),
    onSuccess: async () => {
      await invalidateBookings();
      if ("BroadcastChannel" in window && tenantSlug) {
        try {
          const ch = new BroadcastChannel(BOOKING_CH);
          const ids = items.map((i) => i.id);
          ch.postMessage({
            type: "booking:updated",
            tenantSlug,
            ids,
            ts: Date.now(),
          });
          ch.close();
        } catch {}
      }
    },
  });

  // called by the Checkout button
  const handleCheckout = async () => {
    const ids = items.map((i) => i.id);
    if (!ids.length) return;
    try {
      await bookSlots.mutateAsync({ bookingIds: ids });
    } catch (err) {
      let msg = "Checkout failed. Please try again.";
      if (err instanceof TRPCClientError) {
        msg =
          err.data?.code === "UNAUTHORIZED"
            ? "Please sign in to book slots."
            : err.message || msg;
      }
      toast.error(msg);
    } finally {
      setOpen(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) clear(); // close = empty cart
      }}
    >
      <SheetContent
        side="right"
        className="w-screen max-w-[100vw] p-4 sm:w-[520px] sm:max-w-[520px] sm:p-6 rounded-none sm:rounded-l-xl"
      >
        <SheetHeader>
          <SheetTitle>Booking cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">Cart is empty.</p>
        ) : (
          <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
            {items.map((it) => {
              const start = new Date(it.startIso);
              const end = new Date(it.endIso);
              const when =
                isFinite(start.getTime()) && isFinite(end.getTime())
                  ? `${start.toLocaleDateString()} • ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "—";
              return (
                <li
                  key={it.id}
                  className="border rounded-md p-3 text-sm flex items-center justify-between"
                >
                  <div className="mr-3">
                    <div className="font-medium">{when}</div>
                    <div className="text-muted-foreground">
                      Slot ID: {it.id}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {EUR.format((it.priceCents ?? 0) / 100)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <SheetFooter className="mt-3 sm:mt-4">
          <div className="w-full pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between text-base mb-3">
              <span>Total</span>
              <span className="font-semibold">
                {EUR.format(totalCents / 100)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCheckout}>
                Checkout
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
