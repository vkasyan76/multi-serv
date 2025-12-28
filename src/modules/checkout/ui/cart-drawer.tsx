"use client";

import { useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  getLocaleAndCurrency,
  formatDateForLocale,
} from "@/modules/profile/location-utils";
import { X } from "lucide-react";
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
import { TRPCClientError } from "@trpc/client";

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/modules/home/ui/components/loading-button";
const NONE = "__none__"; // keep a non-empty placeholder value for Select
import { toast } from "sonner";
import { BOOKING_CH, TERMS_VERSION } from "@/constants";
import { platformHomeHref } from "@/lib/utils";

// all props are required: prevents accidental future usage without the tenant handoff
type CartDrawerProps = {
  authState: boolean | null;
  policyAcceptedAt: string | null;
  policyAcceptedVersion: string | null;
};

export function CartDrawer({
  authState,
  policyAcceptedAt,
  policyAcceptedVersion,
}: CartDrawerProps) {
  const open = useCartStore((s) => s.open);
  const setOpen = useCartStore((s) => s.setOpen);
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const remove = useCartStore((s) => s.remove);
  const setService = useCartStore((s) => s.setService); // ← NEW

  const tenantSlug = useCartStore((s) => s.tenant);

  const totalCents = items.reduce((sum, it) => sum + (it.priceCents ?? 0), 0);
  // --- helper: are all slots assigned a service? ---
  const allHaveService = items.every((i) => !!i.serviceId);

  const trpc = useTRPC();
  const qc = useQueryClient();

  // check if policy already accepted:
  // Tenant content always provides these (CartDrawer is tenant-only):
  const authReady = authState !== null;
  const hasUser = authState === true;

  const serverPolicyOk =
    policyAcceptedVersion === TERMS_VERSION && !!policyAcceptedAt;

  // Show the Terms gate when signed-in but the current Terms version is not accepted.
  // Acceptance is recorded on the /terms-of-use page.
  const showAcceptanceGate = hasUser && !serverPolicyOk;

  // for redirect to the terms-of-use page with returnTo=
  const homeHref = platformHomeHref();
  const termsHref =
    homeHref === "/"
      ? "/terms-of-use"
      : `${homeHref.replace(/\/$/, "")}/terms-of-use`;

  // Pull tenant's subcategories/categories to build "Service" options
  const { data: tenant } = useQuery({
    ...trpc.tenants.getOneForCard.queryOptions({ slug: tenantSlug ?? "" }),
    enabled: !!tenantSlug,
    staleTime: 0,
  });

  // Locale & currency from your location utils
  const { locale, currency } = getLocaleAndCurrency();
  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency]
  );
  const fmtTime = useCallback(
    (d: Date) =>
      d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
    [locale]
  );

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

  // create Stripe Checkout session for the reserved slots
  const createSession = useMutation({
    ...trpc.checkout.createSession.mutationOptions(),
  });

  // called by the Checkout button
  const handleCheckout = async () => {
    if (!items.length) return;

    // hard-guard in case someone disables the button in dev tools
    if (!items.every((i) => !!i.serviceId)) {
      toast.error("Please select a service for every slot.");
      return;
    }

    // hard guard so checkout cannot run until session is known:
    if (!authReady) {
      toast.error("Please wait…");
      return;
    }
    if (!hasUser) {
      toast.error("Please sign in to continue.");
      return;
    }

    // accept policy gate
    if (showAcceptanceGate) {
      toast.error("Please review and accept the Terms of Use before checkout.");
      return;
    }

    try {
      // no auto-accept here — acceptance is recorded on the Terms of Use page

      // Step 1 — reserve the slots (available -> booked)
      await bookSlots.mutateAsync({
        // NOTE: server will require serviceId, so we send strings
        items: items.map((i) => ({
          bookingId: i.id,
          serviceId: i.serviceId as string,
        })),
      });

      // Step 2 — create the Checkout session for these slot ids
      const res = await createSession.mutateAsync({
        slotIds: items.map((i) => i.id),
      });

      // Step 3 — send the user to Stripe
      if (res?.url) {
        // optional: close the drawer for a cleaner UX
        setOpen(false);
        window.location.assign(res.url);
      } else {
        toast.error("Could not start checkout. Please try again.");
      }
    } catch (err) {
      let msg = "Checkout failed. Please try again.";
      if (err instanceof TRPCClientError) {
        msg =
          err.data?.code === "UNAUTHORIZED"
            ? "Please sign in to continue."
            : err.message || msg;
      }
      toast.error(msg);
    } finally {
      setOpen(false);
    }
  };

  // Loading button:
  const isBusy = bookSlots.isPending || createSession.isPending;

  // Close the drawer automatically when the cart becomes empty
  useEffect(() => {
    if (open && items.length === 0) {
      setOpen(false); // onOpenChange will run and clear() (safe even if already empty)
    }
  }, [open, items.length, setOpen]);

  // Diagnostics Use Effekt - development only:

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("cart drawer auth", {
        authState,
        policyAcceptedVersion,
        policyAcceptedAt,
      });
    }
  }, [authState, policyAcceptedVersion, policyAcceptedAt]);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        // prevent closing while a session is being created / slots are being booked
        if (!v && isBusy) return;
        setOpen(v);
        if (!v) clear(); // close = empty cart
      }}
    >
      <SheetContent
        side="right"
        className="w-screen max-w-[100vw] p-4 sm:w-[520px] sm:max-w-[520px] sm:p-6 rounded-none flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Booking cart</SheetTitle>
        </SheetHeader>
        <div className="mt-3 sm:mt-4 flex-1 min-h-0 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cart is empty.</p>
          ) : (
            <ul className="space-y-2 sm:space-y-3 pr-1">
              {items.map((it) => {
                const start = new Date(it.startIso);
                const end = new Date(it.endIso);
                const when =
                  isFinite(start.getTime()) && isFinite(end.getTime())
                    ? `${formatDateForLocale(start)} • ${fmtTime(start)}–${fmtTime(end)}`
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
                            disabled={isBusy}
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
                      {money.format((it.priceCents ?? 0) / 100)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(it.id)}
                      aria-label="Remove slot"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <SheetFooter className="mt-3 sm:mt-4">
          {showAcceptanceGate && (
            <div className="mb-3 space-y-2 text-sm">
              <div>
                Please review and accept the{" "}
                <Link
                  className="underline font-medium"
                  href={termsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Use
                </Link>{" "}
                to continue with your booking.
              </div>
            </div>
          )}

          <div className="w-full pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between text-base mb-3">
              <span>Total</span>
              <span className="font-semibold">
                {money.format(totalCents / 100)}
              </span>
            </div>
            <div className="flex gap-2">
              <LoadingButton
                className="flex-1"
                onClick={handleCheckout}
                isLoading={isBusy}
                // loadingText="Redirecting…"
                // if you want just a spinner with no text:
                loadingText=""
                reserveWidth={false}
                disabled={
                  items.length === 0 ||
                  !allHaveService ||
                  isBusy ||
                  !authReady ||
                  !hasUser ||
                  showAcceptanceGate
                }
              >
                Checkout
              </LoadingButton>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)} // closes drawer → will clear due to onOpenChange
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
