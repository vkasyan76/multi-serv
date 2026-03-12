"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ExternalLink,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import LoadingPage from "@/components/shared/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLocaleAndCurrency } from "@/modules/profile/location-utils";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import SettingsHeader from "./SettingsHeader";

export default function PayoutsPanel() {
  const trpc = useTRPC();
  const tProfile = useTranslations("profile");
  const params = useParams<{ lang?: string }>();
  const appLang = normalizeToSupported(params?.lang);
  const vendorProfileHref = `/${appLang}/profile?tab=vendor`;

  // Queries
  const statusQ = useQuery(trpc.auth.getStripeStatus.queryOptions());
  // Prevent flicker on refetches: keepPreviousData
  const balanceQ = useQuery({
    ...trpc.auth.getStripeBalance.queryOptions(),
    placeholderData: keepPreviousData,
  });

  // Mutations
  const onboarding = useMutation(
    trpc.auth.createOnboardingLink.mutationOptions()
  );
  const dashLogin = useMutation(
    trpc.auth.createDashboardLoginLink.mutationOptions()
  );

  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [dashboardBusy, setDashboardBusy] = useState(false);

  // Refetch after returning from Stripe
  const { refetch } = statusQ;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const shouldRefresh =
      u.searchParams.has("onboarding") || u.searchParams.has("resume");

    if (shouldRefresh) {
      refetch();
      u.searchParams.delete("onboarding");
      u.searchParams.delete("resume");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
    }
  }, [refetch]);

  const s = statusQ.data;

  const banner = !s?.hasTenant
    ? tProfile("payouts.messages.provider_required")
    : s.onboardingStatus === "completed"
      ? tProfile("payouts.messages.active")
      : tProfile("payouts.messages.finish_onboarding");

  const openInNewTab = (url: string) =>
    window.open(url, "_blank", "noopener,noreferrer");

  const onStartOrResume = async () => {
    try {
      setOnboardingBusy(true);
      const res = await onboarding.mutateAsync(undefined);
      const url = res?.url;
      if (!url) throw new Error("No URL returned from server");
      openInNewTab(url);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error(tProfile("payouts.errors.open_onboarding_failed"));
    } finally {
      setOnboardingBusy(false);
    }
  };

  const onOpenDashboard = async () => {
    try {
      setDashboardBusy(true);
      const res = await dashLogin.mutateAsync();
      const url = res?.url;
      if (!url) throw new Error("No URL returned from server");
      openInNewTab(url);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error(tProfile("payouts.errors.open_dashboard_failed"));
    } finally {
      setDashboardBusy(false);
    }
  };

  if (statusQ.isLoading) return <LoadingPage />;

  if (statusQ.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 px-4">
        <AlertCircle className="h-12 w-12 text-red-600" />
        <p className="text-lg font-medium">
          {tProfile("payouts.errors.status_load_failed")}
        </p>
        <Button variant="elevated" onClick={() => statusQ.refetch()}>
          {tProfile("payouts.actions.retry")}
        </Button>
      </div>
    );
  }

  // ---- helpers for table display  - displays actual live / test mode from the tenant account status
  const ModeCell = ({
    live,
    loading,
  }: {
    live?: boolean | null;
    loading?: boolean;
  }) => {
    if (loading) {
      return (
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <Loader2
            className="h-4 w-4 animate-spin"
            aria-label={tProfile("payouts.status.loading")}
          />
        </div>
      );
    }

    const label =
      live === true
        ? tProfile("payouts.status.live")
        : live === false
          ? tProfile("payouts.status.test")
          : "—";
    const dotClass =
      live === true
        ? "bg-emerald-500"
        : live === false
          ? "bg-muted-foreground/60"
          : "bg-muted-foreground/30";

    return (
      <div className="inline-flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className="uppercase tracking-wide text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
    );
  };

  const BoolCell = ({ ok }: { ok: boolean }) => (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2
          className="h-5 w-5 text-green-600"
          aria-label={tProfile("payouts.status.enabled")}
        />
      ) : (
        <XCircle
          className="h-5 w-5 text-red-600"
          aria-label={tProfile("payouts.status.disabled")}
        />
      )}
      <span className="text-sm">
        {ok
          ? tProfile("payouts.status.enabled")
          : tProfile("payouts.status.disabled")}
      </span>
    </div>
  );

  const OnboardingCell = ({ status }: { status?: string }) => {
    const v = (status ?? "unknown").toLowerCase();
    if (v === "completed") {
      return (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="capitalize">
            {tProfile("payouts.status.completed")}
          </span>
        </div>
      );
    }
    if (v === "in_progress") {
      return (
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <span className="capitalize">
            {tProfile("payouts.status.in_progress")}
          </span>
        </div>
      );
    }
    if (v === "restricted") {
      return (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="capitalize">
            {tProfile("payouts.status.restricted")}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <span className="capitalize">
          {tProfile("payouts.status.not_started")}
        </span>
      </div>
    );
  };

  // currency + date formatters for the Balance table
  const { locale } = getLocaleAndCurrency(appLang);

  const fmt = (cents: number, currency: string) => {
    const amount = (cents ?? 0) / 100;

    try {
      // Use the route locale + the row's currency
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
    }
  };

  const fmtDate = (iso?: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(iso))
      : "—";

  // ---- UI
  return (
    <div className="flex flex-col gap-2 px-3 sm:px-6 md:px-8 py-4 pb-24 overflow-auto">
      {/* Responsive header */}
      <SettingsHeader title={tProfile("payouts.title")} />

      <Card className="overflow-hidden">
        {/* Stripe accent */}
        {/* <div className="h-1 w-full bg-gradient-to-r from-[#635BFF] via-[#635BFF] to-[#24B47E]" /> */}

        <CardContent className="space-y-4 sm:space-y-6 px-3 pb-4 pt-1 sm:px-6 sm:pb-6 sm:pt-1">
          {/* Stripe-themed banner */}
          <div className="rounded-lg border border-[#E6EBF1] bg-[#F6F9FC] p-4 text-[#0A2540]">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <p className="font-medium text-sm leading-5 sm:text-base sm:leading-6">
                {banner}
              </p>
            </div>
          </div>

          {/* Actions + tables in two columns (stack on small screens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* LEFT: buttons + Status table */}
            <div className="flex flex-col gap-3">
              <Button
                variant="elevated"
                onClick={onStartOrResume}
                disabled={onboardingBusy || !s?.hasTenant}
                className="justify-between bg-black text-white hover:bg-pink-400 hover:text-primary"
                aria-label={tProfile("payouts.aria.open_onboarding")}
              >
                <span>
                  {s?.onboardingStatus === "completed"
                    ? tProfile("payouts.actions.update_details")
                    : tProfile("payouts.actions.onboarding")}
                </span>
                {onboardingBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              <Button
                variant="elevated"
                onClick={onOpenDashboard}
                disabled={dashboardBusy || !s?.hasTenant}
                className="justify-between"
                aria-label={tProfile("payouts.aria.open_dashboard")}
              >
                <span>{tProfile("payouts.actions.open_dashboard")}</span>
                {dashboardBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              {!s?.hasTenant && (
                <Link href={vendorProfileHref} className="w-full">
                  <Button variant="outline" className="w-full">
                    {tProfile("payouts.actions.create_provider")}
                  </Button>
                </Link>
              )}

              {/* Status table UNDER the buttons */}
              <div className="rounded-lg border bg-background overflow-hidden mt-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-1/3">
                        {tProfile("payouts.table.field")}
                      </TableHead>
                      <TableHead>{tProfile("payouts.table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{tProfile("payouts.table.onboarding")}</TableCell>
                      <TableCell>
                        <OnboardingCell status={s?.onboardingStatus} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>{tProfile("payouts.table.charges")}</TableCell>
                      <TableCell>
                        <BoolCell ok={!!s?.chargesEnabled} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>{tProfile("payouts.table.payouts")}</TableCell>
                      <TableCell>
                        <BoolCell ok={!!s?.payoutsEnabled} />
                      </TableCell>
                    </TableRow>
                    {s?.onboardingStatus === "completed" && (
                      <TableRow>
                        <TableCell>{tProfile("payouts.table.mode")}</TableCell>
                        <TableCell>
                          <ModeCell
                            live={balanceQ.data?.livemode}
                            loading={balanceQ.isLoading && !balanceQ.data}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* RIGHT: Balance & Payouts table */}
            <div className="rounded-lg border bg-background overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-1/3">
                      {tProfile("payouts.table.currency")}
                    </TableHead>

                    {/* hidden on xs */}
                    <TableHead className="text-right hidden sm:table-cell">
                      {tProfile("payouts.table.available")}
                    </TableHead>
                    <TableHead className="text-right hidden sm:table-cell">
                      {tProfile("payouts.table.pending")}
                    </TableHead>

                    <TableHead className="text-right">
                      {tProfile("payouts.table.total")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balanceQ.isError ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        <div className="flex items-center justify-center gap-3 py-3">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <span className="text-sm font-medium">
                            {tProfile("payouts.errors.balance_load_failed")}
                          </span>
                          <Button size="sm" onClick={() => balanceQ.refetch()}>
                            {tProfile("payouts.actions.retry")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (balanceQ.data?.balances ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        {balanceQ.isLoading ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-label={tProfile("payouts.status.loading")}
                            />
                          </div>
                        ) : (
                          tProfile("payouts.messages.no_balance")
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    balanceQ.data!.balances.map((row) => (
                      <TableRow key={row.currency}>
                        <TableCell className="uppercase">
                          {row.currency}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {fmt(row.available, row.currency)}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {fmt(row.pending, row.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(row.total, row.currency)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}

                  <TableRow className="bg-muted/20">
                    <TableCell className="font-medium">
                      {tProfile("payouts.table.next_payout")}
                    </TableCell>
                    <TableCell colSpan={3} className="text-right">
                      {fmtDate(balanceQ.data?.estimatedNextPayoutAt)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
