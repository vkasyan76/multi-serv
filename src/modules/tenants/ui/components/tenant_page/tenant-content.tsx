"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import { useRouter, usePathname, useSearchParams } from "next/navigation"; // for navigation after chekout
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { MAX_SLOTS_PER_BOOKING } from "@/constants";
import { TenantCard } from "@/modules/tenants/ui/components/tenant-card";
import LoadingPage from "@/components/shared/loading";

import type { Category } from "@/payload-types";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { BookingActionButton } from "./booking-action-button";

// import { CartDrawer } from "@/modules/checkout/ui/cart-drawer";
import { SlotsCartDrawer } from "@/modules/checkout/ui/slots-cart-drawer";
import { getHourlyRateCents } from "@/modules/checkout/cart-utils";
import {
  useCartStore,
  type CartItem,
} from "@/modules/checkout/store/use-cart-store";
import { ConversationSheet } from "@/modules/conversations/ui/conversation-sheet";
import { TenantReviewSummary } from "@/modules/reviews/ui/tenant-review-summary";
import { CategoryIcon } from "@/modules/categories/category-icons";
import Image from "next/image";
import Link from "next/link";

import { platformHomeHref } from "@/lib/utils";

import { useTenantAuth } from "./hooks/use-tenant-auth";

// import TenantCalendar from "@/modules/bookings/ui/TenantCalendar";

// Dynamic import for calendar to reduce initial bundle size
const TenantCalendar = dynamic(
  () => import("@/modules/bookings/ui/TenantCalendar"),
  {
    ssr: false,
    loading: () => null,
  },
);
//  restore cart atomically (used after Stripe redirect)
const PM_CART_KEY = "pm_cart_restore_v1";
const PM_CART_TTL_MS = 5 * 60 * 1000;

export default function TenantContent({ slug }: { slug: string }) {
  const homeHref = platformHomeHref();
  const tBookings = useTranslations("bookings");
  const tCheckout = useTranslations("checkout");
  const tTenantPage = useTranslations("tenantPage");

  // ensures "/plumbing" becomes "https://root-domain/plumbing" in prod,
  // and stays "/plumbing" in dev
  const toPlatform = (path: string) => {
    if (homeHref === "/") return path;
    const base = homeHref.endsWith("/") ? homeHref.slice(0, -1) : homeHref;
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  };

  const [selected, setSelected] = useState<string[]>([]);
  const [calendarReady, setCalendarReady] = useState(false); // for showing skeleton when the calendar is loading due to dynamic import

  // check slots availability for message blow the calendar:

  type CalendarAvail = {
    loading: boolean;
    hasAvailableSlots: boolean; // in the CURRENT visible view (day on mobile, week on desktop)
    hasAnyAvailableSlots: boolean; // in the fetched window (so mobile can know "other days")
    view: "day" | "week";
  };

  const [calendarAvail, setCalendarAvail] = useState<CalendarAvail | null>(
    null,
  );

  const handleAvailabilityChange = useCallback((v: CalendarAvail) => {
    setCalendarAvail(v);
  }, []);

  const handleCalendarReady = useCallback(() => {
    setCalendarReady(true);
  }, []);

  useEffect(() => {
    setCalendarReady(false);
  }, [slug]);

  // Reviews & Ratings:

  const trpc = useTRPC();

  // Reviews & Ratings:
  const reviewSummaryQ = useQuery(
    trpc.reviews.summaryForTenant.queryOptions({ slug }),
  );

  const reviewRating = reviewSummaryQ.data?.avgRating ?? undefined;
  const reviewCount = reviewSummaryQ.data?.totalReviews ?? undefined;

  // redirect after checkout:
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  // Legacy immediate-pay checkout query params (kept for reference only; should not be used now).
  const cancel = search.get("checkout") === "cancel";
  const success = search.get("checkout") === "success"; // legacy flow only
  const sessionId = search.get("session_id") || "";

  const clearCart = useCartStore((s) => s.clear); // NEW
  const successHandledRef = useRef(false);

  // Legacy cleanup for abandoned immediate-pay checkout sessions.
  // Kept for reference; in the invoice-first flow this should never fire.
  const release = useMutation({
    ...trpc.checkout.releaseOnCancel.mutationOptions(),
    retry: false,
  });
  const isCancelling = cancel && !!sessionId; // cancelling payment process

  // Auth + language + "warmup gate" in one place.
  // waiting for bridge validation
  const {
    signedState,
    viewerKey,
    appLang,
    onBridgeResync,
    profileQ, // to pass to pass into CartDrawer for checking terms acceptance
  } = useTenantAuth(slug);

  const scrollToCalendar = () => {
    window.dispatchEvent(
      new CustomEvent("tenant:set-active", { detail: "booking" }),
    );
    document
      .getElementById("booking")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleBookService = () => {
    scrollToCalendar();
    if (signedState === false)
      toast.info(tBookings("cta.select_slots_then_sign_in"));
  };

  // conversation
  // conversation trigger (MUST be before any early return)
  // must be before any early return
  const [chatOpen, setChatOpen] = useState(false);

  // If the user is logged out, bridge.authenticated === false -> you get the toast and the sheet does not open.
  const handleContact = async () => {
    if (signedState === true) {
      setChatOpen(true);
      return;
    }

    if (signedState === false) {
      toast.error(tBookings("cta.sign_in_to_contact"));
      return;
    }

    // signedState === null (still resolving): retry bridge/profile once
    try {
      const ok = await onBridgeResync();
      if (ok) setChatOpen(true);
      else toast.error(tBookings("cta.sign_in_to_contact"));
    } catch {
      toast.error(tBookings("cta.sign_in_to_contact"));
    }
  };

  const handleClearSelection = () => {
    setSelected([]);
  };
  const cartOpen = useCartStore((s) => s.open);
  const prevOpenRef = useRef(cartOpen);

  // keep the card-drawer open after Stripe redirect
  const pmSetup = search.get("pm_setup"); // "success" | "cancel" | null
  const setCartOpen = useCartStore((s) => s.setOpen);
  const setCart = useCartStore((s) => s.setCart);
  const cartLen = useCartStore((s) => s.items.length);

  useEffect(() => {
    if (!pmSetup) return;

    // Restore cart BEFORE opening drawer (otherwise it opens empty and may auto-close).
    if (cartLen === 0) {
      try {
        const raw = sessionStorage.getItem(PM_CART_KEY);
        if (raw) {
          const snap = JSON.parse(raw) as {
            tenantSlug?: string;
            items?: CartItem[];
            ts?: number;
          };

          const fresh =
            typeof snap.ts === "number"
              ? Date.now() - snap.ts < PM_CART_TTL_MS
              : true;

          if (
            fresh &&
            snap.tenantSlug === slug &&
            Array.isArray(snap.items) &&
            snap.items.length > 0
          ) {
            setCart(slug, snap.items);
            setSelected(snap.items.map((i) => i.id)); // Restore calendar highlight too.
          }

          sessionStorage.removeItem(PM_CART_KEY);
        }
      } catch {
        // ignore
      }
    }

    setCartOpen(true);
  }, [pmSetup, cartLen, setCart, setCartOpen, slug]);

  // refetch profile when the cart opens and when the tab regains focus.
  const refetchProfile = profileQ.refetch;
  useEffect(() => {
    if (!cartOpen) return;

    // When cart opens, ensure customer snapshot is fresh
    void refetchProfile();

    // If user edits profile in another tab, refetch when coming back
    const onFocus = () => void refetchProfile();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [cartOpen, refetchProfile]);

  // Best-effort success handler after redirect from Stripe Checkout.
  useEffect(() => {
    if (!success || !sessionId || successHandledRef.current) return;
    successHandledRef.current = true;

    // UX: acknowledge and clean up immediately
    toast.success(tCheckout("toast.payment_received_finalizing"));

    // Clear local cart so the user does not see stale items.
    clearCart();

    // remove the query params (?checkout=success&session_id=...)
    router.replace(pathname);
    // NEW: after a Stripe redirect, do one best-effort bridge/profile resync
    // So chat/booking does not hit the rare "still resolving" window.
    (async () => {
      try {
        await onBridgeResync();
        router.refresh();
      } catch {
        // ignore (best-effort only)
      }
    })();
  }, [
    success,
    sessionId,
    clearCart,
    router,
    pathname,
    onBridgeResync,
    tCheckout,
  ]);

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
          // Explicit success/error handling. Do not clear the URL on failure, and allow a retry.
          onError: () => {
            // Let the effect try again later (or user can refresh)
            didReleaseRef.current = false;
            toast.error(tCheckout("errors.release_checkout_failed"));
            // Keep the URL params so the next run can retry
          },
        },
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
          tBookings("selection.limit_reached", {
            count: MAX_SLOTS_PER_BOOKING,
          }),
        );
        return prev;
      }

      // add
      return [...prev, id];
    });
  };

  const { data: cardTenant, isLoading: cardLoading } = useQuery({
    ...trpc.tenants.getOneForCard.queryOptions({ slug }),
    enabled: !!slug && !isCancelling, // pause heavy data work while the cancel flow is in progress
    staleTime: 0, // Was 60_000; must be 0.
    gcTime: 0, // Optional, but helps avoid leaking last-user cache after unmount.
    refetchOnMount: "always", // Force fresh fetch when the page opens or navigates.
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    // placeholderData: keepPreviousData,
  });

  // check for subcategories to adjust layout
  const subcatsLen = cardTenant?.subcategories?.length ?? 0;
  const hasSubcats = subcatsLen > 0;
  const subcatsTooMany = subcatsLen > 3;
  const competenciesSpan =
    !hasSubcats || subcatsTooMany ? "md:col-span-2" : "md:col-span-1";

  const subcatsSpan = subcatsTooMany ? "md:col-span-2" : "md:col-span-1";

  // Grab "parent" category once (used for subcategory links/colors).
  const categoriesArr = cardTenant?.categories ?? [];

  // to avoid a runtime error is because you access cardTenant.categories before cardTenant exists.

  let parentCat: Category | null = null;
  for (const c of categoriesArr) {
    if (typeof c !== "string") {
      parentCat = c;
      break;
    }
  }

  const parentSlug = parentCat?.slug ?? null;
  const parentColor = parentCat?.color ?? null;

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

  // we remove waitingForAuth from loading check to make the page available to unlogged users
  if (cardLoading || !cardTenant) {
    return <LoadingPage />;
  }

  const pricePerHourCents = getHourlyRateCents(cardTenant); // for passing into BookingActionButton

  // check if user is also the tenat whose page is visisted
  const isOwner =
    signedState === true &&
    !!viewerKey &&
    viewerKey === (cardTenant.user?.id ?? null);

  return (
    <div className="px-3 sm:px-4 lg:px-12 py-2">
      {/* NEW: Mobile card above grid (ChatGPT's approach) */}
      <section className="lg:hidden mb-2">
        <TenantCard
          tenant={cardTenant}
          reviewRating={reviewRating}
          reviewCount={reviewCount}
          isSignedIn={signedState} // tri-state: true | false | null
          variant="detail"
          showActions
          ordersCount={ordersCount}
          onBook={handleBookService}
          appLang={appLang}
          onContact={handleContact}
          isOwner={isOwner}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        {/* Main Content - Left Column */}
        <div className="space-y-4 min-w-0">
          {/* About Section */}
          <section
            id="about"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-16"
          >
            {/* <h2 className="text-2xl font-bold mb-4">About</h2> */}
            <h2 className="text-2xl font-bold mb-4 inline-flex items-center gap-3">
              <Image
                src="/SVGs/Writing.svg"
                alt=""
                aria-hidden="true"
                width={56}
                height={56}
                className="opacity-90"
              />
              <span>{tTenantPage("sections.about")}</span>
            </h2>
            <div className="rounded-2xl border bg-white/70 p-5 shadow-sm">
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed wrap-break-word">
                {cardTenant?.bio || tTenantPage("bio.empty")}
              </p>
            </div>
          </section>

          {/* Services Section */}
          <section
            id="services"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4 inline-flex items-center gap-3">
              <Image
                src="/SVGs/Services_3d-2.svg"
                alt=""
                aria-hidden="true"
                width={64}
                height={64}
                className="opacity-90"
              />
              <span>{tTenantPage("sections.services")}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* My Competencies (FIRST / LEFT) */}
              {cardTenant?.categories && cardTenant.categories.length > 0 && (
                <div
                  className={[
                    "rounded-2xl border bg-white/70 p-5 shadow-sm",
                    competenciesSpan,
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center">
                      <Image
                        src="/SVGs/Competencies.svg"
                        alt=""
                        aria-hidden="true"
                        width={22}
                        height={22}
                        className="opacity-90 object-contain -translate-y-[1px]"
                      />
                    </div>

                    <h3 className="text-base font-semibold leading-6">
                      {tTenantPage("services.competencies")}
                    </h3>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {cardTenant.categories.map(
                      (category: string | Category) => {
                        const cat =
                          typeof category === "string" ? null : category;

                        const key = cat?.id ?? String(category);
                        const name = cat?.name ?? String(category);
                        const icon = cat?.icon ?? null;

                        const slug = cat?.slug ?? null;
                        const color = cat?.color ?? null;

                        if (!slug) {
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                              <CategoryIcon
                                icon={icon}
                                label={name}
                                size={12}
                              />
                              <span className="truncate">{name}</span>
                            </span>
                          );
                        }
                        return (
                          <Link
                            key={key}
                            href={toPlatform(`/${slug}`)}
                            prefetch={false}
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            style={
                              color ? { backgroundColor: color } : undefined
                            }
                            aria-label={`Open category ${name}`}
                          >
                            <CategoryIcon
                              icon={icon}
                              label={name}
                              size={14}
                              className="text-white"
                            />
                            <span className="truncate">{name}</span>
                          </Link>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {/* My Offer (Subcategories) - full width to avoid gaps */}
              {cardTenant?.subcategories &&
                cardTenant.subcategories.length > 0 && (
                  <div
                    className={[
                      "rounded-2xl border bg-white/70 p-5 shadow-sm",
                      subcatsSpan,
                    ].join(" ")}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 flex items-center justify-center">
                          <Image
                            src="/SVGs/Competencies_Toolbox.svg"
                            alt=""
                            aria-hidden="true"
                            width={44}
                            height={44}
                            className="opacity-90 scale-125"
                          />
                        </div>

                        <h3 className="text-base font-semibold leading-6">
                          {tTenantPage("services.specialisation")}
                        </h3>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {cardTenant.subcategories.map(
                          (subcategory: string | Category) => {
                            const sub =
                              typeof subcategory === "string"
                                ? null
                                : subcategory;

                            const key = sub?.id ?? String(subcategory);
                            const name = sub?.name ?? String(subcategory);
                            const subSlug = sub?.slug ?? null;

                            // If we can build /{categorySlug}/{subSlug}, make it a link
                            if (parentSlug && subSlug) {
                              return (
                                <Link
                                  key={key}
                                  href={toPlatform(`/${parentSlug}/${subSlug}`)}
                                  prefetch={false}
                                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                  style={
                                    parentColor
                                      ? { backgroundColor: parentColor }
                                      : undefined
                                  }
                                  aria-label={`Open subcategory ${name}`}
                                >
                                  <span className="truncate">{name}</span>
                                </Link>
                              );
                            }

                            // Fallback: non-clickable chip
                            return (
                              <span
                                key={key}
                                className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm"
                              >
                                <span className="truncate">{name}</span>
                              </span>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </section>

          {/* booking Section */}
          <section
            id="booking"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-16 min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4 inline-flex items-center gap-3">
              <Image
                src="/SVGs/Calendar.svg"
                alt=""
                aria-hidden="true"
                width={64}
                height={64}
                className="opacity-90"
              />
              <span>{tBookings("section.title")}</span>
            </h2>

            <div className="relative min-h-[50vh]">
              <TenantCalendar
                key={slug}
                tenantSlug={slug}
                editable={false}
                selectForBooking={true}
                selectedIds={selected}
                onToggleSelect={handleToggleSelect}
                onAvailabilityChange={handleAvailabilityChange}
                onReady={handleCalendarReady}
              />
              {!calendarReady && (
                <div className="absolute inset-0 z-10 rounded-lg bg-muted animate-pulse pointer-events-none" />
              )}
            </div>
            {selected.length === 0 && (
              <div className="mt-4 rounded-lg border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                {!calendarAvail || calendarAvail.loading ? (
                  <>{tBookings("availability.loading")}</>
                ) : calendarAvail.hasAvailableSlots ? (
                  <>{tBookings("availability.select_slot")}</>
                ) : calendarAvail.view === "day" &&
                  calendarAvail.hasAnyAvailableSlots ? (
                  <>{tBookings("availability.no_slots_day")}</>
                ) : calendarAvail.view === "week" ? (
                  <>{tBookings("availability.no_slots_week")}</>
                ) : (
                  <>{tBookings("availability.no_slots_any")}</>
                )}
              </div>
            )}

            {/* Selection controls */}
            {selected.length > 0 && (
              <div className="mt-4 hidden sm:flex gap-3">
                <div className="flex-1">
                  <BookingActionButton
                    signedState={signedState}
                    slug={slug}
                    selectedIds={selected}
                    pricePerHourCents={pricePerHourCents}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleClearSelection}
                  className="flex-1"
                >
                  {tBookings("selection.clear")}
                </Button>
              </div>
            )}

            {/* We use SlotsCartDrawer instead of CartDrawer */}
            <SlotsCartDrawer
              authState={signedState}
              policyAcceptedAt={profileQ.data?.policyAcceptedAt ?? null}
              policyAcceptedVersion={
                profileQ.data?.policyAcceptedVersion ?? null
              }
              customer={
                profileQ.data
                  ? {
                      firstName: profileQ.data.firstName ?? null,
                      lastName: profileQ.data.lastName ?? null,
                      location: profileQ.data.location ?? null,
                      country: profileQ.data.country ?? null,
                      onboardingCompleted:
                        profileQ.data.onboardingCompleted ?? false,
                    }
                  : null
              }
            />

            {/* Sticky mobile CTA (mobile only) */}
            {selected.length > 0 && (
              <div className="sm:hidden sticky bottom-0 inset-x-0 z-20 bg-background/95 border-t p-3">
                <BookingActionButton
                  signedState={signedState}
                  slug={slug}
                  selectedIds={selected}
                  pricePerHourCents={pricePerHourCents}
                />
              </div>
            )}
          </section>

          {/* Reviews Section */}
          <section
            id="reviews"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-16 min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4 inline-flex items-center gap-3">
              <Image
                src="/SVGs/Review.svg"
                alt=""
                aria-hidden="true"
                width={56}
                height={56}
                className="opacity-90"
              />
              <span>{tTenantPage("sections.reviews")}</span>
            </h2>

            <TenantReviewSummary
              slug={slug}
              summary={reviewSummaryQ.data ?? null}
              summaryIsLoading={reviewSummaryQ.isLoading}
              summaryIsError={reviewSummaryQ.isError}
            />
          </section>
        </div>

        {/* Desktop Sidebar - Right Column (updated with new props) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[104px] sm:top-[120px] lg:top-16 space-y-4">
            {/* Desktop tenant card with action buttons */}
            <TenantCard
              tenant={cardTenant}
              reviewRating={reviewRating}
              reviewCount={reviewCount}
              isSignedIn={signedState}
              variant="detail"
              showActions
              ordersCount={ordersCount}
              onBook={handleBookService}
              appLang={appLang}
              onContact={handleContact}
              isOwner={isOwner}
            />
            {/* REMOVED: Contact and Pricing sections - now redundant */}
          </div>
        </aside>
      </div>
      {/* Conversation Sheet */}
      <ConversationSheet
        open={chatOpen}
        onOpenChangeAction={setChatOpen}
        tenantSlug={slug}
        tenantName={cardTenant.name}
        tenantAvatarUrl={
          cardTenant.image?.url ?? cardTenant.user?.clerkImageUrl ?? null
        }
        myAvatarUrl={null}
        disabled={signedState !== true}
        authState={signedState}
        viewerKey={viewerKey}
        onBridgeResync={onBridgeResync}
        appLang={appLang}
      />
    </div>
  );
}
