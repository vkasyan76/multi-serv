"use client";
import { useState } from "react";
import Link from "next/link";
import { Poppins } from "next/font/google";

import { cn, platformHomeHref } from "@/lib/utils";
import { usePathname } from "next/navigation";

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

const navbarItems = [
  { href: "/", children: "Home" },
  { href: "/about", children: "About" },
  { href: "/features", children: "Features" },
  { href: "/pricing", children: "Pricing" },
  { href: "/contact", children: "Contact" },
  { href: "/terms-of-use", children: "Terms of Use" },
  { href: "/impressum", children: "Impressum" },
];

export const Navbar = () => {
  const trpc = useTRPC();
  const session = useQuery(trpc.auth.session.queryOptions());

  // Get info for user's tenant:
  const { data: myTenant, isLoading: isMineLoading } = useQuery({
    ...trpc.tenants.getMine.queryOptions({}),
    enabled: !!session.data?.user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // links to point to /dashboard (platform root)
  const homeHref = platformHomeHref();

  const dashHref = myTenant
    ? `${homeHref.replace(/\/$/, "")}/dashboard`
    : "/profile?tab=vendor";

  // Only disable when session says user has a tenant but getMine hasn't returned it yet
  const hasTenant = !!session.data?.user?.tenants?.length;
  const isDashLoading = hasTenant && !myTenant && isMineLoading;

  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    //  <na className="h-16 flex border-b justify-between font-medium bg-white">
    <nav className="sticky top-0 z-50 h-16 flex border-b justify-between font-medium bg-white">
      <Link href="/" className="pl-6 flex items-center">
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
              <span>Log in</span>
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
              <Link href="/admin">Admin panel</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="secondary"
                className="w-32 border-l border-t-0 border-b-0 border-r-0 px-12 h-full rounded-none bg-white hover:bg-pink-400 transition-colors text-lg"
              >
                <Link href="/profile">Profile</Link>
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
                  {myTenant ? "Dashboard" : "Start Business"}
                </Link>
              </LoadingButton>
            </>
          )}

          {/* Clerk user avatar/profile button (always shown when logged in) */}
          <div className="ml-4">
            <UserButton
              userProfileMode="navigation"
              userProfileUrl="/profile"
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
