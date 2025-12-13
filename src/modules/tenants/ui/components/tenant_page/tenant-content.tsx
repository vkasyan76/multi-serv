"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useRouter, usePathname, useSearchParams } from "next/navigation"; // for navigation after chekout
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { ConversationSheet } from "@/modules/conversations/ui/conversation-sheet";
import { TenantReviewSummary } from "@/modules/reviews/ui/tenant-review-summary";
import { CategoryIcon } from "@/modules/categories/category-icons";
import Image from "next/image";
import Link from "next/link";
import { platformHomeHref } from "@/lib/utils";

import {
  type AppLang,
  normalizeToSupported,
  getInitialLanguage,
} from "@/modules/profile/location-utils";

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
  const homeHref = platformHomeHref();

  // ensures "/plumbing" becomes "https://root-domain/plumbing" in prod,
  // and stays "/plumbing" in dev
  const toPlatform = (path: string) => {
    if (homeHref === "/") return path;
    const base = homeHref.endsWith("/") ? homeHref.slice(0, -1) : homeHref;
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  };

  const [selected, setSelected] = useState<string[]>([]);
  const trpc = useTRPC();

  // Bridge declaration.
  // use auth.getUserProfile as the backend “am I signed in?” source:
  const {
    data: bridge,
    isLoading: bridgeLoading,
    isFetching: bridgeFetching,
  } = useBridge(); // Gate the tRPC query with the bridge in your client component

  // Reviews & Ratings:
  const reviewSummaryQ = useQuery(
    trpc.reviews.summaryForTenant.queryOptions({ slug })
  );

  const reviewRating = reviewSummaryQ.data?.avgRating ?? undefined;
  const reviewCount = reviewSummaryQ.data?.totalReviews ?? undefined;

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

  // const { isSignedIn, isLoaded } = useUser();
  // eslint-disable-next-line
  const { user } = useUser();
  // const signedState = isLoaded ? !!isSignedIn : null;

  // Determine app language using bridege.
  // If the first getUserProfile result is wrong because of timing (cold start / cookie race), it won’t stay cached and block chat.
  const profileQ = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: bridge?.authenticated === true, // ONLY when bridge says authed
    retry: false,

    // don’t keep a “bad first answer” around
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  const waitingForBridge = bridgeLoading || bridgeFetching || !bridge?.ok; // This way the page renders immediately, while chat correctly shows “Checking sign-in…” until ready.

  // Compute signedState from backend profile (tri-state)
  // Stops treating “temporary error / timing / refetch” as “signed out”.
  // If the backend returns null, you immediately get false (signed out) and stop showing “Checking sign-in…” forever.

  const signedState: boolean | null = useMemo(() => {
    if (!bridge?.ok) return null;

    // definitive logout comes from bridge
    if (bridge.authenticated === false) return false;

    // bridge says authed, but profile may still be loading / erroring
    if (profileQ.isError) return null;
    if (profileQ.data) return true;

    return null; // authed but profile not ready yet
  }, [bridge?.ok, bridge?.authenticated, profileQ.data, profileQ.isError]);

  const viewerKey = signedState === true ? (profileQ.data?.id ?? null) : null;

  const appLang: AppLang = useMemo(() => {
    const profileLang = profileQ.data?.language;
    if (profileLang) {
      return normalizeToSupported(profileLang);
    }
    return getInitialLanguage();
  }, [profileQ.data?.language]);

  const scrollToCalendar = () => {
    window.dispatchEvent(
      new CustomEvent("tenant:set-active", { detail: "booking" })
    );
    document
      .getElementById("booking")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // conversation
  // conversation trigger (MUST be before any early return)
  // must be before any early return
  const [chatOpen, setChatOpen] = useState(false);

  // If the user is logged out, bridge.authenticated === false → you get the toast and the sheet does not open.
  const handleContact = () => {
    // definitive: bridge says "not authenticated" -> toast, don't open
    if (bridge?.ok && bridge.authenticated === false) {
      toast.error("Sign in to contact this provider.");
      return;
    }

    // otherwise allow opening; if profile still resolving, the sheet can show "Checking sign-in…"
    setChatOpen(true);
  };

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

  const { data: cardTenant, isLoading: cardLoading } = useQuery({
    ...trpc.tenants.getOneForCard.queryOptions({ slug }),
    enabled: !!bridge?.ok && !isCancelling, // pause heavy data work while the cancel flow is in progress
    staleTime: 0, // ← was 60_000; must be 0
    gcTime: 0, // ← optional but good to prevent leaking last-user cache after unmount
    refetchOnMount: "always", // ← force fresh fetch when page opens/navigates
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

  // grab “parent” category once (used for subcategory links/colors)
  // grab parent category (used for subcategory links/colors)
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
          appLang={appLang}
          onContact={handleContact}
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
              <span>About</span>
            </h2>
            <div className="rounded-2xl border bg-white/70 p-5 shadow-sm">
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed wrap-break-word">
                {cardTenant?.bio || "No bio available."}
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
              <span>Services</span>
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
                      My Competencies:
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
                      }
                    )}
                  </div>
                </div>
              )}

              {/* My Offer (Subcategories) — full width to avoid gaps */}
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
                          Specialisation:
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
                          }
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
              <span>Booking</span>
            </h2>

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
              <span>Reviews</span>
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
              onBook={scrollToCalendar}
              appLang={appLang}
              onContact={handleContact}
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
      />
    </div>
  );
}
