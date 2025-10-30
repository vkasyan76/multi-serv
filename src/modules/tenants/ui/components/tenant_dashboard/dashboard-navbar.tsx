"use client";

import Link from "next/link";
import Image from "next/image";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Home, UserCog } from "lucide-react";
import { cn, tenantPublicHref, platformHomeHref } from "@/lib/utils";
import { Poppins } from "next/font/google";
import DashboardSubnav from "./dashboard-subnav";
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

export default function DashboardNavbar({ slug }: Props) {
  const trpc = useTRPC();
  const { data: tenant } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({ slug })
  );

  const avatarUrl = tenant?.image?.url ?? null;
  const publicHref = tenantPublicHref(slug); // avatar/name (tenant public)
  const homeHref = platformHomeHref(); // home icon (platform root)
  const profileUrl = `${homeHref}${homeHref.endsWith("/") ? "" : "/"}profile?tab=vendor`; // profile icon (platform root + profile)

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
      <div className="mx-auto max-w-[var(--breakpoint-xl)] px-3 sm:px-4 lg:px-12">
        <TooltipProvider>
          {/* lg+: one row */}
          <div className="hidden lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4 lg:h-16">
            {/* Left: avatar+name → public page */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={publicHref}
                  className="flex items-center gap-2 min-w-0"
                  aria-label="View my Page"
                >
                  {avatarUrl && (
                    <Image
                      src={avatarUrl}
                      alt={tenant?.name ?? "Tenant"}
                      width={32}
                      height={32}
                      className="size-8 rounded-full border shrink-0"
                    />
                  )}
                  <p
                    className={cn(
                      "text-xl font-semibold truncate",
                      poppins.className
                    )}
                  >
                    {tenant?.name}
                  </p>
                </Link>
              </TooltipTrigger>
              <TooltipContent>View my Page</TooltipContent>
            </Tooltip>

            {/* Center: subnav */}
            <div className="justify-self-center">
              <DashboardSubnav />
            </div>

            {/* Right: icons */}
            <div className="flex items-center justify-end gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={profileUrl}
                    className="p-2 rounded-full hover:bg-muted"
                    aria-label="My Profile"
                  >
                    <UserCog className="h-7 w-7" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>My Profile</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={homeHref} // due to domain re-write in production, this goes to home
                    className="p-2 rounded-full hover:bg-muted"
                    aria-label="Home"
                  >
                    <Home className="h-7 w-7" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Home</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* <lg: two rows */}
          <div className="lg:hidden">
            <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={publicHref}
                    className="flex items-center gap-2 min-w-0"
                    aria-label="Open public page"
                  >
                    {avatarUrl && (
                      <Image
                        src={avatarUrl}
                        alt={tenant?.name ?? "Tenant"}
                        width={32}
                        height={32}
                        className="size-8 rounded-full border shrink-0"
                      />
                    )}
                    <p
                      className={cn(
                        "text-lg sm:text-xl font-semibold truncate",
                        poppins.className
                      )}
                    >
                      {tenant?.name}
                    </p>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Open public page</TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-3">
                <Link
                  href={profileUrl}
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label="Vendor profile"
                >
                  <UserCog className="h-7 w-7" />
                </Link>
                <Link
                  href={homeHref} // due to domain re-write in production, this goes to home
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label="Home"
                >
                  <Home className="h-7 w-7" />
                </Link>
              </div>
            </div>

            <div className="border-t bg-white/90 backdrop-blur">
              <div className="h-12 sm:h-14 flex items-center justify-center px-3">
                <DashboardSubnav />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </nav>
  );
}

/** Skeleton used by <Suspense/> in the layout */
export function DashboardNavbarSkeleton() {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
      <div className="mx-auto max-w-[var(--breakpoint-xl)] px-3 sm:px-4 lg:px-12">
        <div className="hidden lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4 lg:h-16">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-full bg-muted animate-pulse" />
            <div className="h-5 w-40 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="justify-self-center h-9 w-64 rounded-full bg-muted animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="size-8 rounded-full bg-muted animate-pulse" />
            <div className="size-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>

        <div className="lg:hidden">
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-muted animate-pulse" />
              <div className="h-5 w-36 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-muted animate-pulse" />
              <div className="size-8 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
          <div className="border-t">
            <div className="h-12 sm:h-14 flex items-center justify-center">
              <div className="h-9 w-64 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
