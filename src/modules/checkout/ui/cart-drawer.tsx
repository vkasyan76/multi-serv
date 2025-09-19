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
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
const NONE = "__none__"; // keep a non-empty placeholder value for Select
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
  const setService = useCartStore((s) => s.setService); // ← NEW

  const tenantSlug = useCartStore((s) => s.tenant);

  const totalCents = items.reduce((sum, it) => sum + (it.priceCents ?? 0), 0);
  // --- helper: are all slots assigned a service? ---
  const allHaveService = items.every((i) => !!i.serviceId);

  const trpc = useTRPC();
  const qc = useQueryClient();

  // Pull tenant's subcategories/categories to build "Service" options
  const { data: tenant } = useQuery({
    ...trpc.tenants.getOneForCard.queryOptions({ slug: tenantSlug ?? "" }),
    enabled: !!tenantSlug,
    staleTime: 0,
  });

  type IdName = { id: string; name?: string | null };
  type RelRef = string | IdName;

  const toOption = (x: RelRef): { id: string; label: string } =>
    typeof x === "string"
      ? { id: x, label: x }
      : { id: x.id, label: x.name ?? x.id };

  const serviceOptions = ((): Array<{ id: string; label: string }> => {
    if (!tenant) return [];
    // Prefer subcategories; fallback to categories
    const sub = ((tenant.subcategories ?? []) as RelRef[]).map(toOption);
    const cat = ((tenant.categories ?? []) as RelRef[]).map(toOption);
    const raw = sub.length > 0 ? sub : cat;

    // de-dupe by id, preserve order
    const seen = new Set<string>();
    return raw.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  })();

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
    if (!items.length) return;

    // hard-guard in case someone disables the button in dev tools
    if (!items.every((i) => !!i.serviceId)) {
      toast.error("Please select a service for every slot.");
      return;
    }

    try {
      await bookSlots.mutateAsync({
        // NOTE: server will require serviceId, so we send strings
        items: items.map((i) => ({
          bookingId: i.id,
          serviceId: i.serviceId as string,
        })),
      });
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
                    {/* Service picker (subcategory preferred; fallback to category) */}
                    {serviceOptions.length > 0 && (
                      <div className="mt-2">
                        <Select
                          value={it.serviceId ?? NONE} // empty string = "no selection"
                          onValueChange={(val) =>
                            setService(it.id, val === NONE ? null : val)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE} disabled>
                              Pick a service
                            </SelectItem>
                            {serviceOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
              <Button
                className="flex-1"
                onClick={handleCheckout}
                disabled={!allHaveService || bookSlots.isPending}
              >
                Checkout
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
