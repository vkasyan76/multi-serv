"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TenantCard } from "@/modules/tenants/ui/components/tenant-card";
import { Phone, Globe } from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function TenantContent({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const { isSignedIn } = useUser();

  const { data: tenant } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({ slug })
  );

  return (
    <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main Content - Left Column */}
        <div className="space-y-8">
          {/* About Section */}
          <section
            id="about"
            className="scroll-mt-[104px] sm:scroll-mt-[120px] lg:scroll-mt-[64px] min-h-[200px]"
          >
            <h2 className="text-2xl font-bold mb-4">About</h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed">
                {tenant?.bio || "No bio available."}
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
              {tenant?.services && tenant.services.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Service Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {tenant.services.map((service) => (
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

              {/* Categories */}
              {tenant?.categories && tenant.categories.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {tenant.categories.map((category) => (
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

              {/* Subcategories */}
              {tenant?.subcategories && tenant.subcategories.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Subcategories</h3>
                  <div className="flex flex-wrap gap-2">
                    {tenant.subcategories.map((subcategory) => (
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
                    ))}
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
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">Calendar integration coming soon</p>
              <p className="text-sm text-gray-500 mt-2">
                Schedule management and booking functionality will be available
                here.
              </p>
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

        {/* Sticky Sidebar - Right Column */}
        <aside className="hidden lg:block">
          <div className="sticky top-[104px] sm:top-[120px] lg:top-[64px] space-y-4">
            {/* Tenant Card */}
            <TenantCard
              tenant={tenant}
              reviewRating={4.5}
              reviewCount={12}
              isSignedIn={isSignedIn ?? false}
            />

            {/* Contact Information */}
            {(tenant?.phone || tenant?.website) && (
              <div className="bg-white p-4 rounded-lg border space-y-3">
                <h3 className="font-semibold text-gray-900">Contact</h3>
                {tenant.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{tenant.phone}</span>
                  </div>
                )}
                {tenant.website && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe className="w-4 h-4" />
                    <a
                      href={
                        tenant.website.startsWith("http")
                          ? tenant.website
                          : `https://${tenant.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      {tenant.website}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Pricing */}
            {tenant?.hourlyRate && (
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Pricing</h3>
                <div className="text-2xl font-bold text-green-600">
                  €{tenant.hourlyRate}/hr
                </div>
                <p className="text-sm text-gray-600">Hourly rate</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
