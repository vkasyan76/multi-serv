"use client";
import { useState } from "react";
import Link from "next/link";
import { Poppins } from "next/font/google";

import { cn, platformHomeHref } from "@/lib/utils";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/modules/home/ui/components/loading-button";

import { NavbarSidebar } from "./navbar-sidebar";
import { MenuIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  // SignUpButton,
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
  const session = useQuery(trpc.auth.session.queryOptions());
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

  // Get info for user's tenant:
  const { data: myTenant, isLoading: isMineLoading } = useQuery({
    ...trpc.tenants.getMine.queryOptions({}),
    enabled: !!session.data?.user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const dashHref = myTenant
    ? platformHref("/dashboard")
    : href("/profile?tab=vendor");

  // Only disable when session says user has a tenant but getMine hasn't returned it yet
  const hasTenant = !!session.data?.user?.tenants?.length;
  const isDashLoading = hasTenant && !myTenant && isMineLoading;

  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    //  <na className="h-16 flex border-b justify-between font-medium bg-white">
    <nav className="sticky top-0 z-50 h-16 flex border-b justify-between font-medium bg-white">
      <Link href={href("/")} className="pl-6 flex items-center">
        <span className={cn("text-5xl font-semibold", poppins.className)}>
          Infinisimo
        </span>
      </Link>

      <NavbarSidebar
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        items={navbarItems}
      />

      <div className="items-center gap-4 hidden lg:flex">
        {navbarItems.map((item) => (
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
      <div className="hidden lg:flex gap-2 items-center pr-6">
        <SignedOut>
          {/* Only show Clerk SignInButton for unauthenticated users */}
          <SignInButton>
            <Button
              asChild
              variant="secondary"
              className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-white hover:bg-pink-400 transition-colors text-lg"
            >
              <span>{t("nav.login")}</span>
            </Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          {/* Screen reader announcement for button text changes */}
          <div aria-live="polite" className="sr-only">
            {session.data?.user?.tenants?.length
              ? "Navigation updated: Dashboard button available"
              : "Navigation updated: Start Business button available"}
          </div>

          {/* Show role/tenant-based buttons for authenticated users */}
          {session.data?.user?.roles?.includes("super-admin") ? (
            <Button
              asChild
              className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
            >
              <Link href={href("/dashboard/admin")}>Admin Panel</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="secondary"
                className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-white hover:bg-pink-400 transition-colors text-lg"
              >
                <Link href={href("/profile")}>{t("nav.profile")}</Link>
              </Button>
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
                  {/* Label now depends on the same source as href */}
                  {myTenant ? t("nav.dashboard") : t("nav.start_business")}
                </Link>
              </LoadingButton>
            </>
          )}

          {/* Clerk user avatar/profile button (always shown when logged in) */}
          <div className="ml-4">
            <UserButton
              userProfileMode="navigation"
              userProfileUrl={href("/profile")}
            />
          </div>
        </SignedIn>
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
