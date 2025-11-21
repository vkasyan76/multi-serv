"use client";

import { useState, useEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useRouter, usePathname, useSearchParams } from "next/navigation"; // for navigation after chekout
import { useQuery, keepPreviousData, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { MAX_SLOTS_PER_BOOKING } from "@/constants";
import { TenantCard } from "@/modules/tenants/ui/components/tenant-card";

import { useBridge } from "./BridgeAuth";
import LoadingPage from "@/components/shared/loading";

import type { Category } from "@/payload-types";
import { useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";
// import { CartButton } from "@/modules/checkout/ui/cart-button";
// add:
import { BookSlotsButton } from "@/modules/checkout/ui/book-slots-button";
import { CartDrawer } from "@/modules/checkout/ui/cart-drawer";
import { getHourlyRateCents } from "@/modules/checkout/cart-utils";
import { useCartStore } from "@/modules/checkout/store/use-cart-store";
import { TenantReviewSummary } from "@/modules/reviews/ui/tenant-review-summary";

// import TenantCalendar from "@/modules/bookings/ui/TenantCalendar";

// Dynamic import for calendar to reduce initial bundle size
const TenantCalendar = dynamic(
  () => import("@/modules/bookings/ui/TenantCalendar"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[50vh] bg-muted animate-pulse rounded-lg" />
    ),
  }
);

export default function TenantContent({ slug }: { slug: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const trpc = useTRPC();

  // Reviews & Ratings:
  const { data: reviewSummary } = useQuery(
    trpc.reviews.summaryForTenant.queryOptions({ slug })
  );

  const reviewRating = reviewSummary?.avgRating ?? undefined;
  const reviewCount = reviewSummary?.totalReviews ?? undefined;

  // redirect after checkout:
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const cancel = search.get("checkout") === "cancel";
  const success = search.get("checkout") === "success"; // NEW
  const sessionId = search.get("session_id") || "";

  const clearCart = useCartStore((s) => s.clear); // NEW
  const successHandledRef = useRef(false);

  const release = useMutation({
    ...trpc.checkout.releaseOnCancel.mutationOptions(),
    retry: false,
  });
  const isCancelling = cancel && !!sessionId; // canvelling paymente process
  const { isSignedIn, isLoaded } = useUser();
  const signedState = isLoaded ? !!isSignedIn : null;

  const scrollToCalendar = () => {
    window.dispatchEvent(
      new CustomEvent("tenant:set-active", { detail: "booking" })
    );
    document
      .getElementById("booking")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const {
    data: bridge,
    isLoading: bridgeLoading,
    isFetching: bridgeFetching,
  } = useBridge(); // Gate the tRPC query with the bridge in your client component

  // Clear selections on unmount
  useEffect(() => () => setSelected([]), []);

  const handleClearSelection = () => {
    setSelected([]);
  };
  const cartOpen = useCartStore((s) => s.open);
  const prevOpenRef = useRef(cartOpen);

  // best-effort success handler — after redirect from Stripe Checkout
  useEffect(() => {
    if (!success || !sessionId || successHandledRef.current) return;
    successHandledRef.current = true;

    // UX: acknowledge and clean up immediately
    toast.success("Payment received. Finalizing your booking…");

    // clear local cart so user doesn’t see stale items
    clearCart();

    // remove the query params (?checkout=success&session_id=...)
    router.replace(pathname);
  }, [success, sessionId, clearCart, router, pathname]);

  // grey slots selection cleared when cart closes
  useEffect(() => {
    // open -> closed
    if (prevOpenRef.current && !cartOpen) {
      setSelected([]); // clear grey selection on close
    }
    prevOpenRef.current = cartOpen;
  }, [cartOpen]);

  // reverting to available if the payment cancelled.
  // fire once
  const didReleaseRef = useRef(false);
  useEffect(() => {
    if (!didReleaseRef.current && cancel && sessionId) {
      didReleaseRef.current = true;

      release.mutate(
        { sessionId },
        {
          onSuccess: () => {
            // Only clear params once the release worked
            router.replace(pathname);
          },
          // explicit success/error handling. Don’t clear the URL on failure, and allow a retry.
          onError: () => {
            // Let the effect try again later (or user can refresh)
            didReleaseRef.current = false;
            toast.error(
              "We couldn't release your checkout session. Please retry in a moment."
            );
            // Keep the URL params so the next run can retry
          },
        }
      );
    }
    // deps intentionally kept to just the URL signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel, sessionId]);

  const handleToggleSelect = (id: string) => {
    setSelected((prev) => {
      // remove if already selected
      if (prev.includes(id)) return prev.filter((x) => x !== id);

      // enforce selection cap
      if (prev.length >= MAX_SLOTS_PER_BOOKING) {
        toast.warning(
          `You can select up to ${MAX_SLOTS_PER_BOOKING} slots per booking.`
        );
        return prev;
      }

      // add
      return [...prev, id];
    });
  };

  const waitingForBridge = bridgeLoading || bridgeFetching || !bridge?.ok;

  const { data: cardTenant, isLoading: cardLoading } = useQuery({
    ...trpc.tenants.getOneForCard.queryOptions({ slug }),
    enabled: !!bridge?.ok && !isCancelling, // pause heavy data work while the cancel flow is in progress
    staleTime: 0, // ← was 60_000; must be 0
    gcTime: 0, // ← optional but good to prevent leaking last-user cache after unmount
    refetchOnMount: "always", // ← force fresh fetch when page opens/navigates
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  // Aggregated orders count for this tenant
  const { data: tenantOrderStats } = useQuery({
    ...trpc.orders.statsForTenants.queryOptions({
      tenantIds: cardTenant?.id ? [cardTenant.id] : [],
    }),
    enabled: !!cardTenant?.id,
  });

  const ordersCount =
    cardTenant?.id && tenantOrderStats
      ? (tenantOrderStats[cardTenant.id]?.ordersCount ?? undefined)
      : undefined;

  if (waitingForBridge || cardLoading || !cardTenant) {
    return <LoadingPage />; // full-screen overlay while we warm up
  }

  return (
    <div className="px-3 sm:px-4 lg:px-12 py-2">
      {/* NEW: Mobile card above grid (ChatGPT's approach) */}
      <section className="lg:hidden mb-2">
        <TenantCard
          tenant={cardTenant}
          reviewRating={reviewRating}
          reviewCount={reviewCount}
          isSignedIn={signedState} // ← tri-state: true | false | null
          variant="detail"
          showActions
          ordersCount={ordersCount}
          onBook={scrollToCalendar}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        {/* Main Content - Left Column */}
        <div className="space-y-4 min-w-0">
          {/* About Section */}
          <section
            id="about"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4">About</h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed">
                {cardTenant?.bio || "No bio available."}
              </p>
            </div>
          </section>

          {/* Services Section */}
          <section
            id="services"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4">Services</h2>
            <div className="space-y-4">
              {/* Service Types */}
              {cardTenant?.services && cardTenant.services.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Service Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {cardTenant.services.map((service: string) => (
                      <span
                        key={service}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {service === "on-site" ? "On-site" : "Online"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {cardTenant?.categories && cardTenant.categories.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {cardTenant.categories.map(
                      (category: string | Category) => (
                        <span
                          key={
                            typeof category === "string"
                              ? category
                              : category.id
                          }
                          className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                        >
                          {typeof category === "string"
                            ? category
                            : category.name}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {cardTenant?.subcategories &&
                cardTenant.subcategories.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Subcategories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {cardTenant.subcategories.map(
                        (subcategory: string | Category) => (
                          <span
                            key={
                              typeof subcategory === "string"
                                ? subcategory
                                : subcategory.id
                            }
                            className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                          >
                            {typeof subcategory === "string"
                              ? subcategory
                              : subcategory.name}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </section>

          {/* booking Section */}
          <section
            id="booking"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4">Booking</h2>
            <TenantCalendar
              tenantSlug={slug}
              editable={false}
              selectForBooking={true}
              selectedIds={selected}
              onToggleSelect={handleToggleSelect}
            />

            {/* Selection controls */}
            {selected.length > 0 && (
              <div className="mt-4 hidden sm:flex gap-3">
                <div className="flex-1">
                  <BookSlotsButton
                    tenantSlug={slug}
                    selectedIds={selected}
                    pricePerHourCents={getHourlyRateCents(cardTenant)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleClearSelection}
                  className="flex-1"
                >
                  Clear selection
                </Button>
              </div>
            )}

            <CartDrawer />

            {/* Sticky mobile CTA (mobile only) */}
            {selected.length > 0 && (
              <div className="sm:hidden sticky bottom-0 inset-x-0 z-20 bg-background/95 border-t p-3">
                <BookSlotsButton
                  tenantSlug={slug}
                  selectedIds={selected}
                  pricePerHourCents={getHourlyRateCents(cardTenant)}
                />
              </div>
            )}
          </section>

          {/* Reviews Section */}
          <section
            id="reviews"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <TenantReviewSummary slug={slug} />
          </section>
        </div>

        {/* Desktop Sidebar - Right Column (updated with new props) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[104px] sm:top-[120px] lg:top-[64px] space-y-4">
            {/* Desktop tenant card with action buttons */}
            <TenantCard
              tenant={cardTenant}
              reviewRating={reviewRating}
              reviewCount={reviewCount}
              isSignedIn={signedState}
              variant="detail"
              showActions
              ordersCount={ordersCount}
              onBook={scrollToCalendar}
            />
            {/* REMOVED: Contact and Pricing sections - now redundant */}
          </div>
        </aside>
      </div>
    </div>
  );
}
