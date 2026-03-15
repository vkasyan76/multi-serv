"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Home, UserCog } from "lucide-react";
import { cn, tenantPublicHref, platformHomeHref } from "@/lib/utils";
import { type AppLang, normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";
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

function getLocalizedPlatformHref(pathname: string, appLang: AppLang) {
  const localizedPath = withLocalePrefix(pathname, appLang);
  const platformHref = platformHomeHref();

  // Keep locale when production root-domain rewrites route the app via the platform origin.
  if (!platformHref.startsWith("http")) return localizedPath;

  try {
    const url = new URL(platformHref);
    if (!url.hostname || url.hostname === "undefined") {
      return localizedPath;
    }
  } catch {
    return localizedPath;
  }

  return `${platformHref.replace(/\/+$/, "")}${localizedPath}`;
}

export default function DashboardNavbar({ slug }: Props) {
  const trpc = useTRPC();
  const tDashboard = useTranslations("dashboard");
  const params = useParams<{ lang?: string }>();
  const appLang = normalizeToSupported(params?.lang);
  const { data: tenant } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({ slug })
  );

  const avatarUrl = tenant?.image?.url ?? null;
  const publicHref = tenantPublicHref(slug, appLang);
  const homeHref = getLocalizedPlatformHref("/", appLang);
  const profileUrl = getLocalizedPlatformHref("/profile?tab=vendor", appLang);

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
                  aria-label={tDashboard("navbar.public_page")}
                >
                  {avatarUrl && (
                    <Image
                      src={avatarUrl}
                      alt={tenant?.name ?? tDashboard("navbar.tenant_alt")}
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
              <TooltipContent>{tDashboard("navbar.public_page")}</TooltipContent>
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
                    aria-label={tDashboard("navbar.profile")}
                  >
                    <UserCog className="h-7 w-7" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{tDashboard("navbar.profile")}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={homeHref}
                    className="p-2 rounded-full hover:bg-muted"
                    aria-label={tDashboard("navbar.home")}
                  >
                    <Home className="h-7 w-7" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{tDashboard("navbar.home")}</TooltipContent>
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
                    aria-label={tDashboard("navbar.open_public_page")}
                  >
                    {avatarUrl && (
                      <Image
                        src={avatarUrl}
                        alt={tenant?.name ?? tDashboard("navbar.tenant_alt")}
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
                <TooltipContent>
                  {tDashboard("navbar.open_public_page")}
                </TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-3">
                <Link
                  href={profileUrl}
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label={tDashboard("navbar.vendor_profile")}
                >
                  <UserCog className="h-7 w-7" />
                </Link>
                <Link
                  href={homeHref}
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label={tDashboard("navbar.home")}
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
