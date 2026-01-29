"use client";

import { useMemo, useCallback, useEffect, useState } from "react";
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

import { toast } from "sonner";
import { BOOKING_CH, TERMS_VERSION } from "@/constants";
import { platformHomeHref } from "@/lib/utils";
import { TermsAcceptanceDialog } from "@/modules/profile/ui/terms-acceptance-dialog";
import { CartDrawerCustomerInfo } from "@/modules/checkout/ui/cart-drawer-customer-info";
import { PaymentMethodSetup } from "@/modules/payments/ui/payment-method-setup";

import type { User } from "@/payload-types";
const NONE = "__none__";

type CustomerSnapshot = Pick<
  User,
  "firstName" | "lastName" | "location" | "country" | "onboardingCompleted"
>;

type SlotsCartDrawerProps = {
  authState: boolean | null;
  policyAcceptedAt: string | null;
  policyAcceptedVersion: string | null;
  customer: CustomerSnapshot | null;
};

export function SlotsCartDrawer({
  authState,
  policyAcceptedAt,
  policyAcceptedVersion,
  customer,
}: SlotsCartDrawerProps) {
  const customerReady = customer !== null;
  const customerOk = customerReady && customer.onboardingCompleted === true;

  const open = useCartStore((s) => s.open);
  const setOpen = useCartStore((s) => s.setOpen);
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const remove = useCartStore((s) => s.remove);
  const setService = useCartStore((s) => s.setService);

  const tenantSlug = useCartStore((s) => s.tenant);

  const totalCents = items.reduce((sum, it) => sum + (it.priceCents ?? 0), 0);
  const allHaveService = items.every((i) => !!i.serviceId);

  const trpc = useTRPC();
  const qc = useQueryClient();

  const authReady = authState !== null;
  const hasUser = authState === true;

  const [termsOpen, setTermsOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [acceptedThisSession, setAcceptedThisSession] = useState(false);

  const serverPolicyOk =
    policyAcceptedVersion === TERMS_VERSION && !!policyAcceptedAt;

  const policyOk = serverPolicyOk || acceptedThisSession;
  const showAcceptanceGate = hasUser && !policyOk;

  const handleTermsOpenChange = (v: boolean) => {
    setTermsOpen(v);
    if (!v) setPendingCheckout(false);
  };

  const homeHref = platformHomeHref();
  const termsHref =
    homeHref === "/"
      ? "/legal/terms-of-use"
      : `${homeHref.replace(/\/$/, "")}/legal/terms-of-use`;

  const profileHref =
    homeHref === "/" ? "/profile" : `${homeHref.replace(/\/$/, "")}/profile`;

  // tenant (for service options + tenantId for payment profile)
  const { data: tenant } = useQuery({
    ...trpc.tenants.getOneForCard.queryOptions({ slug: tenantSlug ?? "" }),
    enabled: !!tenantSlug,
    staleTime: 0,
  });

  // payment method requirement (same as your legacy drawer)
  const paymentProfileQ = useQuery({
    ...trpc.payments.getOrCreateProfileForTenant.queryOptions({
      tenantId: tenant?.id ?? "",
    }),
    enabled: hasUser && !!tenant?.id,
    staleTime: 0,
  });

  const paymentOk = paymentProfileQ.data?.status === "active";

  // locale/currency
  const { locale, currency } = getLocaleAndCurrency();
  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );
  const fmtTime = useCallback(
    (d: Date) =>
      d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );

  type IdName = { id: string; name?: string | null };
  type RelRef = string | IdName;

  const toOption = (x: RelRef): { id: string; label: string } =>
    typeof x === "string"
      ? { id: x, label: x }
      : { id: x.id, label: x.name ?? x.id };

  const serviceOptions = ((): Array<{ id: string; label: string }> => {
    if (!tenant) return [];
    const sub = ((tenant.subcategories ?? []) as RelRef[]).map(toOption);
    const cat = ((tenant.categories ?? []) as RelRef[]).map(toOption);
    const raw = sub.length > 0 ? sub : cat;

    const seen = new Set<string>();
    return raw.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  })();

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

  // Step 1: reserve slots (available -> booked)
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

  // Step 2: create order (booked -> confirmed + order doc). NO STRIPE.
  const createOrder = useMutation({
    ...trpc.slotCheckout.createOrder.mutationOptions(),
  });

  // fallback release if Step 2 fails after Step 1 succeeded
  const releaseBySlotIds = useMutation({
    ...trpc.checkout.releaseBySlotIds.mutationOptions(),
    retry: false,
  });

  const runCheckout = async () => {
    const cartItems = items.slice();
    if (cartItems.length === 0) return;

    if (cartItems.some((i) => !i.serviceId)) {
      toast.error("Please select a service for every slot.");
      return;
    }

    const slotIds = cartItems.map((i) => i.id);
    let booked = false;

    try {
      await bookSlots.mutateAsync({
        items: cartItems.map((i) => ({
          bookingId: i.id,
          serviceId: i.serviceId as string,
        })),
      });

      booked = true;

      const res = await createOrder.mutateAsync({ slotIds });

      if (!res?.ok || !res.orderId) {
        throw new Error("Could not create order. Please try again.");
      }

      // refresh once more to reflect booked -> confirmed
      await invalidateBookings();

      if ("BroadcastChannel" in window && tenantSlug) {
        try {
          const ch = new BroadcastChannel(BOOKING_CH);
          ch.postMessage({
            type: "booking:updated",
            tenantSlug,
            ids: slotIds,
            ts: Date.now(),
          });
          ch.close();
        } catch {}
      }

      // close + clear
      setOpen(false);
      clear();

      toast.success(
        "Order created. Payment will happen later (after acceptance).",
      );
    } catch (err) {
      if (booked) {
        try {
          await releaseBySlotIds.mutateAsync({ slotIds });
          await invalidateBookings();

          if ("BroadcastChannel" in window && tenantSlug) {
            const ch = new BroadcastChannel(BOOKING_CH);
            ch.postMessage({
              type: "booking:updated",
              tenantSlug,
              ids: slotIds,
              ts: Date.now(),
            });
            ch.close();
          }
        } catch {
          // best-effort only
        }
      }

      let msg = "Checkout failed. Please try again.";
      if (err instanceof TRPCClientError) {
        msg =
          err.data?.code === "UNAUTHORIZED"
            ? "Please sign in to continue."
            : err.message || msg;
      }
      toast.error(msg);
    }
  };

  const handleCheckout = async () => {
    if (!items.length) return;

    if (!items.every((i) => !!i.serviceId)) {
      toast.error("Please select a service for every slot.");
      return;
    }

    if (!authReady) {
      toast.error("Please wait…");
      return;
    }
    if (!hasUser) {
      toast.error("Please sign in to continue.");
      return;
    }

    if (!customerReady) {
      toast.error("Please wait… loading your profile.");
      return;
    }
    if (!customerOk) {
      toast.error(
        "Please complete onboarding (name and address) in your profile before checkout.",
      );
      return;
    }

    if (paymentProfileQ.isPending) {
      toast.error("Please wait…");
      return;
    }
    if (!paymentOk) {
      toast.error(
        `Please add a payment method for ${tenant?.name ?? "this provider"} to continue.`,
      );
      return;
    }

    if (showAcceptanceGate) {
      setPendingCheckout(true);
      setTermsOpen(true);
      return;
    }

    await runCheckout();
  };

  const isBusy = bookSlots.isPending || createOrder.isPending;

  useEffect(() => {
    if (open && items.length === 0) {
      setOpen(false);
    }
  }, [open, items.length, setOpen]);

  useEffect(() => {
    setAcceptedThisSession(false);
  }, [policyAcceptedAt, policyAcceptedVersion, authState]);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v && isBusy) return;
        setOpen(v);
        if (!v) clear();
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

                      {serviceOptions.length > 0 && (
                        <div className="mt-2">
                          <Select
                            value={it.serviceId ?? NONE}
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
          <div className="w-full pb-[env(safe-area-inset-bottom)]">
            <CartDrawerCustomerInfo
              hasUser={hasUser}
              customerReady={customerReady}
              customerOk={customerOk}
              profileHref={profileHref}
              customer={customer}
            />

            {hasUser && tenant?.id && (
              <div className="mt-3">
                <PaymentMethodSetup
                  tenantId={tenant.id}
                  tenantName={tenant.name ?? null}
                />
              </div>
            )}

            {showAcceptanceGate && (
              <div className="mb-3 space-y-2 text-sm">
                <div>
                  You must accept the{" "}
                  <Link
                    className="underline font-medium"
                    href={termsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Use
                  </Link>{" "}
                  to continue. You can accept them when you click Checkout.
                </div>
              </div>
            )}

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
                loadingText=""
                reserveWidth={false}
                disabled={
                  items.length === 0 ||
                  !allHaveService ||
                  isBusy ||
                  !authReady ||
                  !hasUser ||
                  !customerReady ||
                  !customerOk ||
                  paymentProfileQ.isPending ||
                  !paymentOk
                }
              >
                Checkout
              </LoadingButton>

              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  clear();
                }}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetFooter>

        <TermsAcceptanceDialog
          open={termsOpen}
          onOpenChangeAction={handleTermsOpenChange}
          onAcceptedAction={() => {
            setAcceptedThisSession(true);
            if (pendingCheckout) {
              setPendingCheckout(false);
              void runCheckout();
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
