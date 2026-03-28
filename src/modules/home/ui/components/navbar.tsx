"use client";
import { useState } from "react";
import Link from "next/link";
import { Poppins } from "next/font/google";

import { cn, platformHomeHref } from "@/lib/utils";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";
import { LanguageSwitcher } from "@/i18n/ui/language-switcher";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/modules/home/ui/components/loading-button";

import { NavbarSidebar } from "./navbar-sidebar";
import { MenuIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

import {
  SignInButton,
  useAuth,
  UserButton,
} from "@clerk/nextjs";
// import ClerkUserButton from "@/components/clerk/clerk-user-button";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["700"],
});

interface NavbarItemProps {
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
}

const NavbarItem = ({ href, children, isActive }: NavbarItemProps) => {
  return (
    <Button
      asChild
      variant="outline"
      className={cn(
        "bg-transparent hover:bg-transparent rounded-full hover:border-primary border-transparent px-3.5 text-lg",
        isActive && "bg-black text-white hover:bg-black hover:text-white"
      )}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
};

export const Navbar = () => {
  const t = useTranslations("common");
  const trpc = useTRPC();
  const { isLoaded, isSignedIn } = useAuth();
  const session = useQuery({
    ...trpc.auth.session.queryOptions(),
    enabled: isLoaded && isSignedIn,
  });
  const params = useParams<{ lang?: string }>();
  const lang = normalizeToSupported(params?.lang);

  // Keep shell navigation locale-stable while preserving any query string.
  const href = (pathnameWithQuery: string) => {
    const [pathPart, query = ""] = pathnameWithQuery.split("?");
    const localizedPath = withLocalePrefix(pathPart || "/", lang);
    return query ? `${localizedPath}?${query}` : localizedPath;
  };

  // In subdomain mode use platform origin + localized path for dashboard links.
  const platformHref = (pathnameWithQuery: string) => {
    const localized = href(pathnameWithQuery);
    const base = platformHomeHref();
    if (!base.startsWith("http")) return localized;

    try {
      const url = new URL(base);
      if (!url.hostname || url.hostname === "undefined") return localized;
    } catch {
      return localized;
    }

    return `${base.replace(/\/+$/, "")}${localized}`;
  };

  const navbarItems = [
    { href: href("/"), children: t("nav.home") },
    { href: href("/about"), children: t("nav.about") },
    { href: href("/features"), children: t("nav.features") },
    { href: href("/pricing"), children: t("nav.pricing") },
    { href: href("/contact"), children: t("nav.contact") },
    { href: href("/legal/terms-of-use"), children: t("nav.terms_of_use") },
    { href: href("/legal/impressum"), children: t("nav.impressum") },
  ];

  const desktopNavbarItems = [
    { href: href("/"), children: t("nav.home") },
    { href: href("/legal/terms-of-use"), children: t("nav.terms_of_use") },
    { href: href("/legal/impressum"), children: t("nav.impressum") },
  ];

  // Clerk decides whether auth chrome renders at all; session data only picks
  // the role/tenant-specific CTA once the signed-in user is known to the app.
  const user = isLoaded && isSignedIn ? session.data?.user : undefined;
  const isSessionEnrichmentLoading =
    isLoaded && isSignedIn && session.isLoading && !user;
  const canRenderAppCta = !!user;

  // Get info for user's tenant:
  const { data: myTenant, isLoading: isMineLoading } = useQuery({
    ...trpc.tenants.getMine.queryOptions({}),
    enabled: isLoaded && isSignedIn && !!user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const hasTenant = !!user?.tenants?.length;
  const isAdmin = user?.roles?.includes("super-admin");
  const dashHref = hasTenant
    ? platformHref("/dashboard")
    : href("/profile?tab=vendor");
  const dashboardLabel = hasTenant
    ? t("nav.dashboard_cta")
    : t("nav.start_business_cta");

  // Only disable when session says user has a tenant but getMine hasn't returned it yet.
  const isDashLoading = hasTenant && !myTenant && isMineLoading;

  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    //  <na className="h-16 flex border-b justify-between font-medium bg-white">
    <nav className="sticky top-0 z-50 h-16 flex border-b justify-between font-medium bg-white">
      <Link href={href("/")} className="pl-6 flex items-center shrink-0">
        <span className={cn("text-5xl font-semibold", poppins.className)}>
          Infinisimo
        </span>
      </Link>

      <NavbarSidebar
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        items={navbarItems}
      />

      <div className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-2 overflow-hidden px-4">
        {desktopNavbarItems.map((item) => (
          <NavbarItem
            key={item.href}
            href={item.href}
            isActive={pathname === item.href}
          >
            {item.children}
          </NavbarItem>
        ))}
      </div>

      {/* Right Section - Clerk Auth Buttons */}
      <div className="hidden lg:flex gap-2 items-center pr-6 shrink-0">
        {/* Phase 6: keep switcher near auth/profile actions (desktop only). */}
        <LanguageSwitcher
          className="w-auto min-w-0 rounded-full px-3.5 text-lg"
          isAuthenticated={isLoaded && isSignedIn}
        />
        {!isLoaded ? (
          <>
            <div
              aria-hidden="true"
              className="h-12 w-32 rounded-none border-l bg-neutral-100"
            />
            <div
              aria-hidden="true"
              className="ml-4 h-10 w-10 rounded-full bg-neutral-100"
            />
          </>
        ) : !isSignedIn ? (
          <SignInButton>
            <Button
              asChild
              variant="secondary"
              className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-white hover:bg-pink-400 transition-colors text-lg"
            >
              <span>{t("nav.login")}</span>
            </Button>
          </SignInButton>
        ) : (
          <>
            <Button
              asChild
              variant="secondary"
              className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-white hover:bg-pink-400 transition-colors text-lg"
            >
              <Link href={href("/profile")}>{t("nav.profile")}</Link>
            </Button>

            {isSessionEnrichmentLoading ? (
              <div
                aria-hidden="true"
                className="h-12 w-32 rounded-none border-l bg-neutral-100"
              />
            ) : !canRenderAppCta ? null : isAdmin ? (
              <Button
                asChild
                className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
              >
                {/* Admin CTA intentionally stays English because Payload admin is internal-only UI. */}
                <Link href={href("/dashboard/admin")}>Admin Panel</Link>
              </Button>
            ) : (
              <>
                {/* Announce the app CTA only once session enrichment resolved. */}
                <div aria-live="polite" className="sr-only">
                  {hasTenant
                    ? t("nav.sr_dashboard_available")
                    : t("nav.sr_start_business_available")}
                </div>
                <LoadingButton
                  asChild
                  isLoading={session.isLoading || isDashLoading}
                  loadingText=""
                  className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
                >
                  <Link
                    href={dashHref}
                    onClick={
                      isDashLoading ? (e) => e.preventDefault() : undefined
                    }
                    className={cn(isDashLoading && "opacity-60")}
                    aria-disabled={isDashLoading}
                    aria-busy={isDashLoading}
                  >
                    {dashboardLabel}
                  </Link>
                </LoadingButton>
              </>
            )}

            <div className="ml-4">
              <UserButton
                userProfileMode="navigation"
                userProfileUrl={href("/profile")}
              />
            </div>
          </>
        )}
      </div>

      {/* oposite of large screens */}

      <div className="flex lg:hidden items-center justify-center">
        <Button
          variant="ghost"
          className="size-12 border-transparent bg-white"
          onClick={() => setIsSidebarOpen(true)}
        >
          <MenuIcon />
        </Button>
      </div>
    </nav>
  );
};
