"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import {
  useQueryClient,
  useSuspenseQuery,
  useMutation,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/trpc/routers/_app";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { MAX_SLOTS_PER_BOOKING } from "@/constants";
import { TenantCard } from "@/modules/tenants/ui/components/tenant-card";

// near top (module scope is fine)
const BOOKING_CH = "booking-updates" as const;

// Type definitions for type-safe cache operations
type BookingStatus = "available" | "booked" | "confirmed";

/** Minimal shape we read/write in the cache */
type BookingLite = {
  id: string;
  status: BookingStatus;
  start: string; // ISO
  end: string; // ISO
};

type BookSlotsVars = { bookingIds: string[] };

type BookSlotsResult = {
  bookedIds: string[];
  unavailableIds: string[];
  invalidIds?: string[];
  updated?: number;
};

/** Narrow, type-safe predicates for queryClient predicates */
const isPublicSlotsKey = (q: { queryKey: readonly unknown[] }) =>
  Array.isArray(q.queryKey) &&
  q.queryKey.length >= 2 &&
  q.queryKey[0] === "bookings" &&
  q.queryKey[1] === "listPublicSlots";

const isMineSlotsKey = (q: { queryKey: readonly unknown[] }) =>
  Array.isArray(q.queryKey) &&
  q.queryKey.length >= 2 &&
  q.queryKey[0] === "bookings" &&
  q.queryKey[1] === "listMine";

import type { Category } from "@/payload-types";
import { useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";
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
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  // Clear selections on unmount
  useEffect(() => () => setSelected([]), []);

  const bookSlots = useMutation<
    BookSlotsResult,
    TRPCClientErrorLike<AppRouter>,
    BookSlotsVars,
    { snapshots: Array<[readonly unknown[], BookingLite[] | undefined]> }
  >({
    ...trpc.bookings.bookSlots.mutationOptions(),

    // 1) Optimistic update
    onMutate: async (vars) => {
      // cancel in-flight fetches for public slots
      await queryClient.cancelQueries({ predicate: isPublicSlotsKey });

      // snapshot public slots data so we can roll back
      const snapshots = queryClient.getQueriesData<BookingLite[]>({
        predicate: isPublicSlotsKey,
      });

      // mark each selected id as booked in every matching cache
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData<BookingLite[]>(
          key,
          data.map((b) =>
            vars.bookingIds.includes(b.id) ? { ...b, status: "booked" } : b
          )
        );
      }

      return { snapshots };
    },

    // 2) Success handling (typed result)
    onSuccess: async (result) => {
      const { bookedIds, unavailableIds } = result;

      // clear selection
      setSelected((prev) => {
        const next = new Set(prev);
        bookedIds.forEach((id) => next.delete(id));
        unavailableIds.forEach((id) => next.delete(id));
        return Array.from(next);
      });

      // revert "missed" ones immediately
      if (unavailableIds.length) {
        const snaps = queryClient.getQueriesData<BookingLite[]>({
          predicate: isPublicSlotsKey,
        });
        for (const [key, data] of snaps) {
          if (!data) continue;
          queryClient.setQueryData<BookingLite[]>(
            key,
            data.map((b) =>
              unavailableIds.includes(b.id) ? { ...b, status: "available" } : b
            )
          );
        }
      }

      // toasts (unchanged)
      if (bookedIds.length && !unavailableIds.length) {
        toast.success(
          `Successfully booked ${bookedIds.length} slot${bookedIds.length > 1 ? "s" : ""}.`
        );
      } else if (bookedIds.length && unavailableIds.length) {
        toast.warning(
          `Booked ${bookedIds.length} slot${bookedIds.length > 1 ? "s" : ""}. ${unavailableIds.length} were no longer available.`
        );
      } else {
        toast.error("No slots were available for booking.");
      }

      // broadcast (unchanged)
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const ch = new BroadcastChannel(BOOKING_CH);
        ch.postMessage({
          type: "booking:updated",
          tenantSlug: slug,
          ids: bookedIds,
          ts: Date.now(),
        });
        ch.close();
      }
    },

    // 3) Rollback on error (typed error & context)
    onError: (err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          queryClient.setQueryData<BookingLite[] | undefined>(key, data);
        }
      }
      toast.error(err.message ?? "An error occurred while booking slots.");
    },

    // 4) Always refetch to sync truth
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ predicate: isPublicSlotsKey }),
        queryClient.invalidateQueries({ predicate: isMineSlotsKey }),
      ]);
    },
  });

  const handleToggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((slotId) => slotId !== id);
      } else {
        if (prev.length >= MAX_SLOTS_PER_BOOKING) {
          toast.warning(
            `You can select up to ${MAX_SLOTS_PER_BOOKING} slots per booking.`
          );
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleBookSelected = async () => {
    if (!selected.length) return;
    await bookSlots.mutateAsync({ bookingIds: selected });
    // Nothing else here. onSuccess/onError already do toasts + invalidation.
  };

  const handleClearSelection = () => {
    setSelected([]);
  };

  const { data: cardTenant } = useSuspenseQuery(
    trpc.tenants.getOneForCard.queryOptions({ slug })
  ); // returns TenantWithRelations with distance calculated on server

  return (
    <div className="px-3 sm:px-4 lg:px-12 py-2">
      {/* NEW: Mobile card above grid (ChatGPT's approach) */}
      <section className="lg:hidden mb-2">
        <TenantCard
          tenant={cardTenant}
          reviewRating={4.5}
          reviewCount={12}
          isSignedIn={!!isSignedIn}
          variant="detail"
          showActions
          ordersCount={12} // placeholder; wire real value later
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

          {/* Availability Section */}
          <section
            id="availability"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4">Availability</h2>
            <TenantCalendar
              tenantSlug={slug}
              editable={false}
              selectForBooking={true}
              selectedIds={selected}
              onToggleSelect={handleToggleSelect}
            />

            {/* Selection controls */}
            <div className="mt-3 flex items-center gap-3">
              <Button
                disabled={!selected.length || bookSlots.isPending}
                onClick={handleBookSelected}
                className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
              >
                {bookSlots.isPending
                  ? "Booking..."
                  : `Book selected (${selected.length})`}
              </Button>
              {selected.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearSelection}
                  className="text-sm text-gray-600 underline"
                >
                  Clear selection
                </Button>
              )}
            </div>

            {/* Sticky mobile CTA (mobile only) */}
            <div
              className="sm:hidden sticky bottom-0 inset-x-0 z-20 bg-background/95 border-t p-3"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }} // for notches
            >
              <Button
                className="w-full"
                disabled={!selected.length || bookSlots.isPending}
                onClick={handleBookSelected}
              >
                {selected.length
                  ? `Book ${selected.length} slot${selected.length > 1 ? "s" : ""}`
                  : "Select slots to book"}
              </Button>
            </div>
          </section>

          {/* Reviews Section */}
          <section
            id="reviews"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4">Reviews</h2>
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">Review system coming soon</p>
              <p className="text-sm text-gray-500 mt-2">
                Customer feedback and ratings will be displayed here.
              </p>
            </div>
          </section>
        </div>

        {/* Desktop Sidebar - Right Column (updated with new props) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[104px] sm:top-[120px] lg:top-[64px] space-y-4">
            {/* Desktop tenant card with action buttons */}
            <TenantCard
              tenant={cardTenant}
              reviewRating={4.5}
              reviewCount={12}
              isSignedIn={!!isSignedIn}
              variant="detail"
              showActions
              ordersCount={12} // placeholder; wire real value later
            />
            {/* REMOVED: Contact and Pricing sections - now redundant */}
          </div>
        </aside>
      </div>
    </div>
  );
}
