"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Home } from "lucide-react";
import { platformHomeHref, tenantPublicHref } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type InvoiceTopBarProps = {
  tenantSlug?: string | null;
  tenantName?: string | null;
  tenantAvatarUrl?: string | null;
};

export function InvoiceTopBar({
  tenantSlug,
  tenantName,
  tenantAvatarUrl,
}: InvoiceTopBarProps) {
  const params = useParams<{ lang?: string }>();
  const homeHref = platformHomeHref();
  const publicHref = tenantSlug ? tenantPublicHref(tenantSlug, params?.lang) : null;
  const displayName = tenantSlug || tenantName || "Public page";

  return (
    <nav className="bg-white w-full border-b">
      <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 h-14 sm:h-16 flex items-center justify-between gap-3">
        <TooltipProvider>
          {publicHref ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={publicHref}
                  className="flex items-center gap-2 min-w-0"
                  aria-label="Public page"
                >
                  {tenantAvatarUrl ? (
                    <Image
                      src={tenantAvatarUrl}
                      alt={displayName}
                      width={28}
                      height={28}
                      className="size-7 rounded-full border shrink-0"
                    />
                  ) : null}
                  <span className="text-sm font-medium truncate">
                    {displayName}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Public page</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              {tenantAvatarUrl ? (
                <Image
                  src={tenantAvatarUrl}
                  alt={displayName}
                  width={28}
                  height={28}
                  className="size-7 rounded-full border shrink-0"
                />
              ) : null}
              <span className="text-sm font-medium truncate">
                {displayName}
              </span>
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={homeHref}
                className="p-2 rounded-full hover:bg-muted"
                aria-label="Home"
              >
                <Home className="h-7 w-7" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Home</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </nav>
  );
}
