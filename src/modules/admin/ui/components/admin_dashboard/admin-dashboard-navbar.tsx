"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { Poppins } from "next/font/google";

import { cn, platformHomeHref } from "@/lib/utils";
import AdminDashboardSubnav from "./admin-dashboard-subnav";

const poppins = Poppins({ subsets: ["latin"], weight: ["700"] });

export default function AdminDashboardNavbar({
  title = "Admin Dashboard",
  backHref,
  backLabel,
  showSubnav = true,
}: {
  title?: string;
  backHref?: string;
  backLabel?: string;
  showSubnav?: boolean;
}) {
  const homeHref = platformHomeHref();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
      <div className="mx-auto max-w-[var(--breakpoint-xl)] px-3 sm:px-4 lg:px-12 py-2 lg:py-0">
        <div
          className={cn(
            "grid grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[auto_1fr_auto] lg:gap-4",
            showSubnav ? "lg:h-16" : "py-1 lg:py-2",
          )}
        >
          <p
            className={cn(
              "text-lg sm:text-xl lg:text-xl font-semibold truncate",
              poppins.className,
            )}
          >
            {title}
          </p>

          <div className="col-start-2 lg:col-start-3 flex items-center justify-end">
            {backHref && backLabel ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm hover:bg-muted"
                aria-label={backLabel}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : null}
            <Link
              href={homeHref}
              className="p-2 rounded-full hover:bg-muted"
              aria-label="Home"
            >
              <Home className="h-7 w-7" />
            </Link>
          </div>

          {showSubnav ? (
            <div className="col-span-2 row-start-2 flex items-center justify-center border-t bg-white/90 backdrop-blur px-3 py-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-self-center lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none lg:px-0 lg:py-0">
              <AdminDashboardSubnav />
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
