"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { Poppins } from "next/font/google";

import { cn, platformHomeHref } from "@/lib/utils";
import AdminDashboardSubnav from "./admin-dashboard-subnav";

const poppins = Poppins({ subsets: ["latin"], weight: ["700"] });

export default function AdminDashboardNavbar() {
  const homeHref = platformHomeHref();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
      <div className="mx-auto max-w-[var(--breakpoint-xl)] px-3 sm:px-4 lg:px-12">
        <div className="hidden lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4 lg:h-16">
          <div className="flex items-center gap-2 min-w-0">
            <p className={cn("text-xl font-semibold truncate", poppins.className)}>
              Admin Dashboard
            </p>
          </div>

          <div className="justify-self-center">
            <AdminDashboardSubnav />
          </div>

          <div className="flex items-center justify-end gap-4">
            <Link
              href={homeHref}
              className="p-2 rounded-full hover:bg-muted"
              aria-label="Home"
            >
              <Home className="h-7 w-7" />
            </Link>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
            <p
              className={cn(
                "text-lg sm:text-xl font-semibold truncate",
                poppins.className,
              )}
            >
              Admin Dashboard
            </p>
            <Link
              href={homeHref}
              className="p-2 rounded-full hover:bg-muted"
              aria-label="Home"
            >
              <Home className="h-7 w-7" />
            </Link>
          </div>

          <div className="border-t bg-white/90 backdrop-blur">
            <div className="h-12 sm:h-14 flex items-center justify-center px-3">
              <AdminDashboardSubnav />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
