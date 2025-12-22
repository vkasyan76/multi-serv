"use client";

import Link from "next/link";
import Image from "next/image";
import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TenantSubnav } from "./tenant-subnav";
import { TenantShareSheet } from "./tenant-share-sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const poppins = Poppins({ subsets: ["latin"], weight: ["700"] });

interface Props {
  slug: string;
}

export const Navbar = ({ slug }: Props) => {
  const trpc = useTRPC();
  const { data: tenant } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({ slug })
  );

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
      <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12">
        {/* Large screens: Single row layout */}
        <div className="hidden lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4 lg:h-16">
          {/* Left: Tenant Info + Share */}
          <div className="flex items-center gap-2 min-w-0">
            {tenant?.image?.url && (
              <Image
                src={tenant.image.url}
                width={32}
                height={32}
                className="rounded-full border shrink-0 size-8"
                alt={tenant?.name ?? "Tenant"}
              />
            )}

            <p
              className={cn(
                "text-lg sm:text-xl font-semibold truncate min-w-0",
                poppins.className
              )}
            >
              {tenant?.name}
            </p>

            <div className="shrink-0">
              <TenantShareSheet
                slug={slug}
                tenantName={tenant?.name ?? undefined}
                showTooltip
              />
            </div>
          </div>

          {/* Centered tabs */}
          <TenantSubnav headerOffsetPx={{ base: 56, sm: 64 }} />

          {/* Right: brand (large screens) */}
          <div className="justify-self-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={process.env.NEXT_PUBLIC_APP_URL ?? "/"}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    aria-label="Infinisimo Home"
                  >
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      Powered by
                    </span>

                    <Image
                      src="/images/infinisimo_logo_illustrator.png"
                      alt="Infinisimo"
                      width={28}
                      height={28}
                      className="shrink-0"
                    />

                    <span
                      className={cn(
                        "text-base font-semibold",
                        poppins.className
                      )}
                    >
                      Infinisimo
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Home</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Small/Medium screens: Two row layout */}
        <div className="lg:hidden">
          {/* Row 1: Tenant info + brand */}
          <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
            {/* Left: Tenant Info + Share */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {tenant?.image?.url && (
                <Image
                  src={tenant.image.url}
                  width={32}
                  height={32}
                  className="rounded-full border shrink-0 size-6 sm:size-8"
                  alt={tenant?.name ?? "Tenant"}
                />
              )}

              {/* keep name + share together */}
              <div className="flex items-center gap-1 min-w-0">
                <p
                  className={cn(
                    "text-lg sm:text-xl font-semibold truncate min-w-0 max-w-[clamp(8rem,40vw,14rem)]",
                    poppins.className
                  )}
                >
                  {tenant?.name}
                </p>

                <TenantShareSheet
                  slug={slug}
                  tenantName={tenant?.name ?? undefined}
                />
              </div>
            </div>

            {/* Right: brand */}
            <div className="flex items-center gap-2 shrink-0">
              <Image
                src="/images/infinisimo_logo_illustrator.png"
                alt="Infinisimo"
                width={24}
                height={24}
                className="shrink-0"
              />
              <span
                className={cn("text-base font-semibold", poppins.className)}
              >
                Infinisimo
              </span>
            </div>
          </div>

          {/* Row 2: Centered tabs with reduced gaps and extra padding */}
          <div className="border-t bg-white/90 backdrop-blur">
            <div className="h-12 sm:h-14 flex items-center justify-center px-3">
              <TenantSubnav headerOffsetPx={{ base: 104, sm: 120 }} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export const NavbarSkeleton = () => {
  return (
    <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
      <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12">
        {/* Large screens: Single row skeleton */}
        <div className="hidden lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4 lg:h-16">
          {/* Left: Tenant Info Skeleton */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            <div className="w-32 h-6 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Centered tabs skeleton */}
          <div className="flex justify-center">
            <div className="flex gap-3 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-20 h-8 bg-gray-200 rounded-full animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Right: brand skeleton */}
          <div className="justify-self-end">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gray-200 rounded animate-pulse" />
              <div className="w-24 h-6 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Small/Medium screens: Two row skeleton */}
        <div className="lg:hidden">
          {/* Row 1: Tenant info + brand skeleton */}
          <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
            {/* Left: Tenant Info Skeleton */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-24 sm:w-32 h-5 sm:h-6 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Right: brand skeleton */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
              <div className="w-20 h-5 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Row 2: Centered tabs skeleton */}
          <div className="border-t bg-white/90 backdrop-blur">
            <div className="h-12 sm:h-14 flex items-center justify-center px-3">
              <div className="flex gap-2 sm:gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-16 sm:w-20 h-8 bg-gray-200 rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
