"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { withLocalePrefix } from "@/i18n/routing";
import { type AppLang, normalizeToSupported } from "@/lib/i18n/app-lang";
import { WalletFiltersBar } from "@/modules/commissions/ui/wallet-filters-bar";
import {
  buildWalletCsvFilename,
  deriveInvoiceRangeIso,
  downloadCsv,
  walletRowsToCsv,
} from "@/modules/commissions/ui/wallet-filter-utils";
import { WalletSummaryCard } from "@/modules/commissions/ui/wallet-summary-card";
import { WalletTransactionsTable } from "@/modules/commissions/ui/wallet-transactions-table";
import type {
  WalletFilters,
  WalletTransactionRow,
} from "@/modules/commissions/ui/wallet-types";
import { TenantOrdersLifecycleView } from "@/modules/orders/ui/tenant-orders-lifecycle-view";
import { TenantCalendarSkeleton } from "@/modules/tenants/ui/components/skeletons/tenant-calendar-skeleton";
import { TenantMessagesSkeleton } from "@/modules/tenants/ui/components/skeletons/tenant-messages-skeleton";
import { useTRPC } from "@/trpc/client";

const TenantCalendar = dynamic(
  () => import("@/modules/bookings/ui/TenantCalendar"),
  {
    ssr: false,
    loading: () => <TenantCalendarSkeleton />,
  },
);

const TenantMessagesSection = dynamic(
  () =>
    import("@/modules/conversations/ui/tenant-messages-section").then(
      (m) => m.TenantMessagesSection,
    ),
  { ssr: false, loading: () => <TenantMessagesSkeleton /> },
);

function SectionTitle({
  iconSrc,
  label,
  tooltip,
}: {
  iconSrc: string;
  label: string;
  tooltip?: string;
}) {
  const heading = (
    <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold sm:text-xl">
      <Image
        src={iconSrc}
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        className="h-5 w-5 opacity-90 sm:h-6 sm:w-6 lg:h-7 lg:w-7"
      />
      <span>{label}</span>
    </h2>
  );

  if (!tooltip) return heading;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{heading}</TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export default function DashboardContent({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const params = useParams<{ lang?: string }>();
  const tDashboard = useTranslations("dashboard");
  const tFinance = useTranslations("finance");
  const tenantQ = useQuery(trpc.tenants.getOne.queryOptions({ slug }));
  const appLang: AppLang = normalizeToSupported(params?.lang);

  const [walletFilters, setWalletFilters] = useState<WalletFilters>({
    period: { mode: "all" },
    status: "all",
  });
  const [walletRows, setWalletRows] = useState<WalletTransactionRow[]>([]);
  const [walletRowsLoading, setWalletRowsLoading] = useState(false);
  const [walletRowsError, setWalletRowsError] = useState(false);

  const handleWalletDownload = async () => {
    if (walletRowsLoading || walletRowsError || !walletRows.length) return;
    const { startIso, endIso } = deriveInvoiceRangeIso(walletFilters.period);
    const rows = await qc.fetchQuery(
      trpc.commissions.walletTransactionsExport.queryOptions({
        slug,
        status: walletFilters.status,
        start: startIso,
        end: endIso,
      }),
    );
    const csv = walletRowsToCsv(rows);
    const filename = buildWalletCsvFilename({
      period: walletFilters.period,
      status: walletFilters.status,
      appLang,
    });
    downloadCsv(filename, csv);
  };

  const canEditCalendar =
    tenantQ.data?.onboardingStatus === "completed" &&
    tenantQ.data?.payoutsEnabled === true &&
    tenantQ.data?.chargesEnabled === true;

  return (
    <div className="space-y-12">
      <section id="calendar" className="scroll-mt-28 sm:scroll-mt-32">
        <SectionTitle
          iconSrc="/SVGs/Dashboard/Calendar_Icon.svg"
          label={tDashboard("sections.calendar")}
          tooltip={tDashboard("tooltips.calendar")}
        />

        {tenantQ.data && !canEditCalendar && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {tFinance.rich("payouts.messages.calendar_unlock", {
              link: (chunks) => (
                <Link
                  href={withLocalePrefix("/profile?tab=payouts", appLang)}
                  className="font-medium underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </div>
        )}

        <TenantCalendar
          tenantSlug={slug}
          appLang={appLang}
          dashboardMode
          editable={!!canEditCalendar}
        />
      </section>

      <section id="orders" className="scroll-mt-28 sm:scroll-mt-32">
        <SectionTitle
          iconSrc="/SVGs/Dashboard/Orders_Icon.svg"
          label={tDashboard("sections.orders")}
          tooltip={tDashboard("tooltips.orders")}
        />
        <TenantOrdersLifecycleView appLang={appLang} />
      </section>

      <section id="messages" className="scroll-mt-28 sm:scroll-mt-32">
        <SectionTitle
          iconSrc="/SVGs/Dashboard/Messages_Icon.svg"
          label={tDashboard("sections.messages")}
        />
        <div className="rounded-lg border bg-white p-5">
          <TenantMessagesSection tenantSlug={slug} />
        </div>
      </section>

      <section id="finance" className="scroll-mt-28 sm:scroll-mt-32">
        <SectionTitle
          iconSrc="/SVGs/Dashboard/Finance_Icon.svg"
          label={tFinance("dashboard.title")}
        />
        <div className="space-y-4">
          <WalletFiltersBar
            filters={walletFilters}
            appLang={appLang}
            onChange={setWalletFilters}
            download={{
              onClick: handleWalletDownload,
              enabled:
                !walletRowsLoading && !walletRowsError && walletRows.length > 0,
            }}
            onClear={
              walletFilters.status !== "all" ||
              walletFilters.period.mode !== "all"
                ? () =>
                    setWalletFilters({
                      period: { mode: "all" },
                      status: "all",
                    })
                : undefined
            }
          />
          <WalletSummaryCard
            slug={slug}
            appLang={appLang}
            filters={walletFilters}
          />
          <WalletTransactionsTable
            slug={slug}
            appLang={appLang}
            filters={walletFilters}
            onRowsChange={setWalletRows}
            onStateChange={({ isLoading, isError }) => {
              setWalletRowsLoading(isLoading);
              setWalletRowsError(isError);
            }}
          />
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-white p-5">
            <p className="text-muted-foreground">
              {tFinance("payouts.messages.open_panel")}
            </p>
            <Button asChild variant="elevated">
              <Link href={withLocalePrefix("/profile?tab=payouts", appLang)}>
                {tFinance("payouts.actions.open")}
                <ExternalLink className="ml-2 h-4 w-4 opacity-70" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
