"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PayoutsPanel() {
  const trpc = useTRPC();

  // queries follow your existing pattern
  const statusQ = useQuery(trpc.auth.getStripeStatus.queryOptions());

  // mutations follow your existing mutateAsync pattern
  const onboarding = useMutation(
    trpc.auth.createOnboardingLink.mutationOptions()
  );
  const dashLogin = useMutation(
    trpc.auth.createDashboardLoginLink.mutationOptions()
  );

  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [dashboardBusy, setDashboardBusy] = useState(false);

  const urls = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      returnUrl: `${origin}/profile?tab=payouts&onboarding=done`,
      refreshUrl: `${origin}/profile?tab=payouts&resume=1`,
    };
  }, []);

  // refresh after returning from Stripe
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("onboarding") || u.searchParams.get("resume")) {
      statusQ.refetch();
    }
  }, [statusQ]);

  const s = statusQ.data;

  const banner = !s?.hasTenant
    ? "Create your Service Provider profile first."
    : s.onboardingStatus === "completed"
      ? "Payouts are active. Manage your Stripe account from the dashboard."
      : s.onboardingStatus === "restricted"
        ? "Your account is restricted. Open Stripe to resolve requirements."
        : "Finish Stripe onboarding to enable payouts.";

  const primaryCta =
    s?.onboardingStatus === "completed"
      ? "Update Stripe Details"
      : "Start / Resume Onboarding";

  const onStartOrResume = async () => {
    try {
      setOnboardingBusy(true);
      const res = await onboarding.mutateAsync({
        returnUrl: urls.returnUrl,
        refreshUrl: urls.refreshUrl,
      });
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      throw new Error("No URL returned from server");
    } catch (error) {
      console.error("Failed to open Stripe dashboard:", error);
      toast.error("Couldn’t open Stripe onboarding. Please try again.");
    } finally {
      setOnboardingBusy(false);
    }
  };

  const onOpenDashboard = async () => {
    try {
      setDashboardBusy(true);
      const res = await dashLogin.mutateAsync();
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      throw new Error("No URL returned from server");
    } catch (error) {
      console.error("Failed to open Stripe dashboard:", error);
      toast.error("Couldn’t open Stripe dashboard. Please try again.");
    } finally {
      setDashboardBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payouts / Payments</CardTitle>
        <CardDescription>
          Connect Stripe Express to receive payouts.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>{banner}</AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onStartOrResume}
            disabled={onboardingBusy || !s?.hasTenant}
          >
            {primaryCta}
          </Button>
          <Button
            variant="secondary"
            onClick={onOpenDashboard}
            disabled={dashboardBusy || !s?.hasTenant}
          >
            Open Stripe Dashboard
          </Button>
        </div>

        {statusQ.isLoading ? (
          <div className="text-sm opacity-70">Checking status…</div>
        ) : s?.hasTenant ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
              <Badge variant="outline">Onboarding: {s.onboardingStatus}</Badge>
              <Badge variant={s.chargesEnabled ? "default" : "secondary"}>
                Charges: {String(s.chargesEnabled)}
              </Badge>
              <Badge variant={s.payoutsEnabled ? "default" : "secondary"}>
                Payouts: {String(s.payoutsEnabled)}
              </Badge>
            </div>
            {s.requirementsDue?.length ? (
              <div className="text-xs sm:text-sm">
                <div className="font-medium mb-1">Currently due</div>
                <div className="rounded-md bg-muted p-2">
                  <code className="break-words">
                    {s.requirementsDue.join(", ")}
                  </code>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
