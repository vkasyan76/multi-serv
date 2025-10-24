"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import {
  Home,
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

export default function PayoutsPanel() {
  const trpc = useTRPC();

  // Queries
  const statusQ = useQuery(trpc.auth.getStripeStatus.queryOptions());

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
    ? "Create your Service Provider profile first."
    : s.onboardingStatus === "completed"
      ? "Payouts are active. Manage your Stripe account from the dashboard."
      : "Finish Stripe onboarding to enable payouts.";

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
      toast.error("Couldn’t open Stripe onboarding. Please try again.");
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
      toast.error("Couldn’t open Stripe dashboard. Please try again.");
    } finally {
      setDashboardBusy(false);
    }
  };

  if (statusQ.isLoading) return <LoadingPage />;

  // ---- helpers for table display
  const ModeCell = () => (
    <div className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
      <span className="uppercase tracking-wide text-xs font-medium text-muted-foreground">
        {process.env.NODE_ENV === "production" ? "LIVE" : "TEST"}
      </span>
    </div>
  );

  const BoolCell = ({ ok }: { ok: boolean }) => (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="enabled" />
      ) : (
        <XCircle className="h-5 w-5 text-red-600" aria-label="disabled" />
      )}
      <span className="text-sm">{ok ? "Enabled" : "Disabled"}</span>
    </div>
  );

  const OnboardingCell = ({ status }: { status?: string }) => {
    const v = (status ?? "unknown").toLowerCase();
    if (v === "completed") {
      return (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="capitalize">Completed</span>
        </div>
      );
    }
    if (v === "in_progress") {
      return (
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <span className="capitalize">In progress</span>
        </div>
      );
    }
    if (v === "restricted") {
      return (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="capitalize">Restricted</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <span className="capitalize">Not started</span>
      </div>
    );
  };

  // ---- UI
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:px-6 md:px-8 overflow-y-auto max-h-[calc(100vh-7rem)] md:max-h-none">
      {/* Responsive header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <Image
            src="/images/infinisimo_logo_illustrator.png"
            alt="Infinisimo Logo"
            width={44}
            height={44}
            className="rounded-full bg-white"
            priority
          />
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
            Payments &amp; Payouts
          </h1>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Home className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm sm:text-base font-medium">Home</span>
        </Link>
      </div>

      <Card className="overflow-hidden">
        {/* Stripe accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#635BFF] via-[#635BFF] to-[#24B47E]" />

        <CardContent className="space-y-6 p-4 sm:p-6">
          {/* Stripe-themed banner */}
          <div className="rounded-lg border border-[#E6EBF1] bg-[#F6F9FC] p-4 text-[#0A2540]">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <p className="font-medium">{banner}</p>
            </div>
          </div>

          {/* Actions + Status in two columns (stack on small screens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left column: vertical buttons */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={onStartOrResume}
                disabled={onboardingBusy || !s?.hasTenant}
                className="justify-between bg-black text-white hover:bg-pink-400 hover:text-primary"
                aria-label="Open Stripe onboarding in a new tab"
              >
                <span>
                  {s?.onboardingStatus === "completed"
                    ? "Update Stripe Details"
                    : "Start / Resume Onboarding"}
                </span>
                {onboardingBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              <Button
                variant="secondary"
                onClick={onOpenDashboard}
                disabled={dashboardBusy || !s?.hasTenant}
                className="justify-between"
                aria-label="Open Stripe dashboard in a new tab"
              >
                <span>Open Stripe Dashboard</span>
                {dashboardBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              {!s?.hasTenant && (
                <Link href="/profile?tab=vendor" className="w-full">
                  <Button variant="outline" className="w-full">
                    Create Service Provider profile
                  </Button>
                </Link>
              )}
            </div>

            {/* Right column: shadcn Table with icons */}
            <div className="rounded-lg border bg-background overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-1/3">Field</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Onboarding</TableCell>
                    <TableCell>
                      <OnboardingCell status={s?.onboardingStatus} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Charges</TableCell>
                    <TableCell>
                      <BoolCell ok={!!s?.chargesEnabled} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Payouts</TableCell>
                    <TableCell>
                      <BoolCell ok={!!s?.payoutsEnabled} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Mode</TableCell>
                    <TableCell>
                      <ModeCell />
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
