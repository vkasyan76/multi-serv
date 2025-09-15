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

const EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function CartDrawer() {
  const open = useCartStore((s) => s.open);
  const setOpen = useCartStore((s) => s.setOpen);
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);

  const totalCents = items.reduce((sum, it) => sum + (it.priceCents ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[420px] sm:w-[520px]">
        <SheetHeader>
          <SheetTitle>Booking cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">Cart is empty.</p>
        ) : (
          <ul className="mt-4 space-y-3">
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

        <SheetFooter className="mt-4">
          <div className="w-full">
            <div className="flex items-center justify-between text-base mb-3">
              <span>Total</span>
              <span className="font-semibold">
                {EUR.format(totalCents / 100)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => clear()}>
                Clear
              </Button>
              <Button className="flex-1" onClick={() => setOpen(false)}>
                Checkout (soon)
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
