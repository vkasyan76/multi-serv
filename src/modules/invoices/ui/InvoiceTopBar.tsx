"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { localizedPlatformHref, tenantPublicHref } from "@/lib/utils";
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
  const tFinance = useTranslations("finance");
  const params = useParams<{ lang?: string }>();
  const appLang = normalizeToSupported(params?.lang);
  // Invoice top bar needs a localized platform-home escape hatch from tenant flows.
  const homeHref = localizedPlatformHref("/", appLang);
  const publicHref = tenantSlug ? tenantPublicHref(tenantSlug, appLang) : null;
  const displayName =
    tenantName?.trim() ||
    tenantSlug?.trim() ||
    tFinance("invoice.topbar.public_page");

  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto flex h-14 max-w-(--breakpoint-xl) items-center justify-between gap-3 px-4 sm:h-16 lg:px-12">
        <TooltipProvider>
          {publicHref ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={publicHref}
                  className="flex min-w-0 items-center gap-2"
                  aria-label={tFinance("invoice.topbar.public_page")}
                >
                  {tenantAvatarUrl ? (
                    <Image
                      src={tenantAvatarUrl}
                      alt={displayName}
                      width={28}
                      height={28}
                      className="size-7 shrink-0 rounded-full border"
                    />
                  ) : null}
                  <span className="truncate text-sm font-medium">
                    {displayName}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                {tFinance("invoice.topbar.public_page")}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              {tenantAvatarUrl ? (
                <Image
                  src={tenantAvatarUrl}
                  alt={displayName}
                  width={28}
                  height={28}
                  className="size-7 shrink-0 rounded-full border"
                />
              ) : null}
              <span className="truncate text-sm font-medium">
                {displayName}
              </span>
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={homeHref}
                className="rounded-full p-2 hover:bg-muted"
                aria-label={tFinance("invoice.topbar.home")}
              >
                <Home className="h-7 w-7" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>{tFinance("invoice.topbar.home")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </nav>
  );
}
