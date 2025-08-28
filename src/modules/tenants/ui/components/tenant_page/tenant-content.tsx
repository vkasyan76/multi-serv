"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { TenantCard } from "@/modules/tenants/ui/components/tenant-card";
import { normalizeForCard } from "@/modules/tenants/utils/normalize-for-card";
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
  const trpc = useTRPC();
  const { isSignedIn } = useUser();

  const { data: tenantRaw } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({ slug })
  ); // returns Tenant & { image: Media | null }

  const { data: userProfile } = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: !!isSignedIn,
  });

  const viewerCoords =
    userProfile?.coordinates?.lat != null &&
    userProfile?.coordinates?.lng != null
      ? { lat: userProfile.coordinates.lat, lng: userProfile.coordinates.lng }
      : null;

  const cardTenant = normalizeForCard(tenantRaw, viewerCoords);

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
                {tenantRaw?.bio || "No bio available."}
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
              {tenantRaw?.services && tenantRaw.services.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Service Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {tenantRaw.services.map((service: string) => (
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

              {tenantRaw?.categories && tenantRaw.categories.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {tenantRaw.categories.map((category: string | Category) => (
                      <span
                        key={
                          typeof category === "string" ? category : category.id
                        }
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                      >
                        {typeof category === "string"
                          ? category
                          : category.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {tenantRaw?.subcategories &&
                tenantRaw.subcategories.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Subcategories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {tenantRaw.subcategories.map(
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
            <TenantCalendar tenantSlug={slug} />
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
