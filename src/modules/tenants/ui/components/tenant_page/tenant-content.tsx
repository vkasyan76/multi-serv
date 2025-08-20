"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Globe, Euro, Clock } from "lucide-react";
import Image from "next/image";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getInitialLanguage } from "@/modules/profile/location-utils";

export default function TenantContent({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const { data: tenant } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({ slug })
  );
  
  // Get user's locale for consistent date formatting
  const userLocale = getInitialLanguage();

  if (!tenant) {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900">Tenant not found</h1>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-0">
      {/* Header Card */}
      <Card>
        <CardHeader className="text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
            {tenant.image?.url && (
              <Image
                src={tenant.image.url}
                alt={tenant.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-white shadow-lg"
                width={80}
                height={80}
              />
            )}
            <div className="text-center sm:text-left">
              <CardTitle className="text-2xl sm:text-3xl">{tenant.name}</CardTitle>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                {tenant.firstName} {tenant.lastName}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Description */}
          {tenant.bio && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{tenant.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Services & Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Services & Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Service Types */}
              {tenant.services && tenant.services.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Service Types:</h4>
                  <div className="flex flex-wrap gap-2">
                    {tenant.services.map((service) => (
                      <Badge key={service} variant="secondary">
                        {service === "on-site" ? "On-Site" : "Online"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {tenant.categories && tenant.categories.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Categories:</h4>
                  <div className="flex flex-wrap gap-2">
                    {tenant.categories.map((category) => (
                      <Badge
                        key={
                          typeof category === "string" ? category : category.id
                        }
                        variant="outline"
                      >
                        {typeof category === "string"
                          ? category
                          : category.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Subcategories */}
              {tenant.subcategories && tenant.subcategories.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Subcategories:</h4>
                  <div className="flex flex-wrap gap-2">
                    {tenant.subcategories.map((subcategory) => (
                      <Badge
                        key={
                          typeof subcategory === "string"
                            ? subcategory
                            : subcategory.id
                        }
                        variant="outline"
                      >
                        {typeof subcategory === "string"
                          ? subcategory
                          : subcategory.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Contact & Details */}
        <div className="space-y-4 sm:space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenant.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">{tenant.phone}</span>
                </div>
              )}

              {tenant.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-500" />
                  <a
                    href={
                      tenant.website.startsWith("http")
                        ? tenant.website
                        : `https://${tenant.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {tenant.website}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing & Details */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenant.hourlyRate && (
                <div className="flex items-center gap-3">
                  <Euro className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">
                    <span className="font-semibold">{tenant.hourlyRate}€</span>{" "}
                    per hour
                  </span>
                </div>
              )}

                             <div className="flex items-center gap-3">
                 <Clock className="w-5 h-5 text-gray-500" />
                 <span className="text-gray-700">
                   Member since{" "}
                   <span className="font-semibold">
                     {new Date(tenant.createdAt).toLocaleDateString(userLocale, {
                       year: 'numeric',
                       month: 'numeric',
                       day: 'numeric'
                     })}
                   </span>
                 </span>
               </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button className="w-full" size="default">
              Contact Provider
            </Button>
            <Button variant="outline" className="w-full" size="default">
              View Portfolio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
