"use client";

import Link from "next/link";
import Image from "next/image";
import { Phone, Globe } from "lucide-react";
import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

const poppins = Poppins({ subsets: ["latin"], weight: ["700"] });

interface FooterProps {
  slug: string;
}

function toAbsoluteUrl(raw?: string | null) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function prettyWebsite(raw?: string | null) {
  const absolute = toAbsoluteUrl(raw);
  if (!absolute) return "";

  const host = absolute.replace(/^https?:\/\//, "").split("/")[0] ?? ""; // ✅ fixes "possibly undefined" with noUncheckedIndexedAccess

  const clean = host.trim();
  if (!clean) return "";

  // ✅ show "www." in the label (more familiar)
  return clean.startsWith("www.") ? clean : `www.${clean}`;
}

export const Footer = ({ slug }: FooterProps) => {
  const trpc = useTRPC();
  const { data: tenant } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({ slug })
  );

  const websiteHref = toAbsoluteUrl(tenant?.website);
  const websiteLabel = prettyWebsite(tenant?.website);

  return (
    <footer className="border-t font-medium bg-white">
      <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12 py-4 sm:py-6">
        {/* Responsive layout with better spacing */}
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto] items-center gap-4 sm:gap-6">
          {/* Left: Tenant Info */}
          <div className="col-start-1 row-start-1 flex items-center gap-3">
            {tenant?.image?.url && (
              <Image
                src={tenant.image.url}
                alt={tenant?.name ?? "Tenant"}
                width={32}
                height={32}
                className="rounded-full border shrink-0"
              />
            )}
            <span
              className={cn(
                "text-base sm:text-lg font-semibold text-gray-900",
                poppins.className
              )}
            >
              {tenant?.name}
            </span>
          </div>

          {/* Right: Infinisimo Branding */}
          <Link
            href={process.env.NEXT_PUBLIC_APP_URL ?? "/"}
            className="col-start-2 row-start-1 sm:col-start-3 justify-self-end flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity"
          >
            <Image
              src="/images/infinisimo_logo_illustrator.png"
              alt="Infinisimo"
              width={24}
              height={24}
              className="shrink-0"
            />
            <span
              className={cn(
                "text-sm sm:text-lg font-semibold",
                poppins.className
              )}
            >
              Infinisimo
            </span>
          </Link>

          {/* Middle: Contact Information - Better responsive handling */}
          {(tenant?.phone || tenant?.website) && (
            <div className="col-span-2 row-start-2 sm:col-start-2 sm:row-start-1 flex items-center justify-between lg:justify-center gap-4 sm:gap-6 lg:gap-10 min-w-0 px-0 sm:px-4 text-xs sm:text-sm">
              {tenant?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-600 truncate">{tenant.phone}</span>
                </div>
              )}
              {tenant?.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500 shrink-0" />
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate max-w-[140px] sm:max-w-none"
                    title={websiteHref}
                  >
                    {websiteLabel}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};
