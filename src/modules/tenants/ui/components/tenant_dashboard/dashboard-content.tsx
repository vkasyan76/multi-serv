"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
// import { TenantMessagesSection } from "@/modules/conversations/ui/tenant-messages-section";
import { useBridge } from "@/modules/tenants/ui/components/tenant_page/BridgeAuth";
import { TenantCalendarSkeleton } from "@/modules/tenants/ui/components/skeletons/tenant-calendar-skeleton";
import { TenantMessagesSkeleton } from "@/modules/tenants/ui/components/skeletons/tenant-messages-skeleton";
import { useEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

// Heavy calendar (RBC + DnD) – load like on the tenant page to avoid SSR/hydration issues
const TenantCalendar = dynamic(
  () => import("@/modules/bookings/ui/TenantCalendar"),
  {
    ssr: false,
    loading: () => <TenantCalendarSkeleton />,
  }
);

const TenantMessagesSection = dynamic(
  () =>
    import("@/modules/conversations/ui/tenant-messages-section").then(
      (m) => m.TenantMessagesSection
    ),
  { ssr: false, loading: () => <TenantMessagesSkeleton /> }
);

export default function DashboardContent({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const {
    data: bridge,
    isLoading: bridgeLoading,
    isFetching: bridgeFetching,
    refetch: refetchBridge, // refetch page if the calendar was not loaded due to race condition
  } = useBridge();

  //auth sentinel for tenant dashboard (already used by TenantMessagesSection)
  const vendorQ = useQuery({
    ...trpc.auth.getVendorProfile.queryOptions(),
    enabled: bridge?.ok === true && bridge.authenticated === true,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  const didHardReloadRef = useRef(false);

  useEffect(() => {
    if (!bridge?.ok || bridge.authenticated !== true) return;
    if (!vendorQ.isError) return;

    const code = (vendorQ.error as { data?: { code?: string } } | null)?.data
      ?.code;

    if (code !== "UNAUTHORIZED") return;
    if (didHardReloadRef.current) return;

    const loopKey = `dashboardReload:${slug}`;
    const last = sessionStorage.getItem(loopKey);
    if (last && Date.now() - Number(last) < 15_000) return;

    didHardReloadRef.current = true;
    sessionStorage.setItem(loopKey, String(Date.now()));

    (async () => {
      const res = await refetchBridge();
      const ok = res.data?.ok === true && res.data?.authenticated === true;
      if (ok) window.location.reload();
    })();
  }, [
    bridge?.ok,
    bridge?.authenticated,
    vendorQ.isError,
    vendorQ.error,
    refetchBridge,
    slug,
  ]);

  // dashboard to mount its auth-dependent components only when the bridge is definitively authenticated.
  const waitingForBridge =
    bridgeLoading ||
    bridgeFetching ||
    !bridge?.ok ||
    bridge.authenticated !== true ||
    vendorQ.isLoading;

  // stable id that exists in that response for passing to imported components
  const viewerKey = vendorQ.data?.id ?? "anon";

  return (
    <div className="space-y-12">
      {/* CALENDAR */}
      <section id="calendar" className="scroll-mt-28 sm:scroll-mt-32">
        <h2 className="text-xl font-semibold mb-3">Calendar</h2>
        {/* Dashboard mode → calendar is editable */}
        {waitingForBridge ? (
          <TenantCalendarSkeleton />
        ) : (
          <TenantCalendar
            key={`${slug}:${viewerKey}`}
            tenantSlug={slug}
            editable
          />
        )}
      </section>

      {/* ORDERS (placeholder for now) */}
      <section id="orders" className="scroll-mt-28 sm:scroll-mt-32">
        <h2 className="text-xl font-semibold mb-3">Orders</h2>
        <div className="rounded-lg border bg-white p-5">
          <p className="text-muted-foreground">
            Orders table will appear here. We’ll query <code>orders</code> for
            this tenant and show status, total, receipt, and created date.
          </p>
        </div>
      </section>

      {/* MESSAGES (placeholder for now) */}
      <section id="messages" className="scroll-mt-28 sm:scroll-mt-32">
        <h2 className="text-xl font-semibold mb-3">Messages</h2>
        <div className="rounded-lg border bg-white p-5">
          {waitingForBridge ? (
            <TenantMessagesSkeleton />
          ) : (
            <TenantMessagesSection
              key={`${slug}:${viewerKey}`}
              tenantSlug={slug}
            />
          )}
        </div>
      </section>

      {/* FINANCE */}
      <section id="finance" className="scroll-mt-28 sm:scroll-mt-32">
        <h2 className="text-xl font-semibold mb-3">Finance</h2>
        <div className="rounded-lg border bg-white p-5 flex items-center justify-between gap-4">
          <p className="text-muted-foreground">
            Open your payouts & balances panel in Profile.
          </p>
          <Button asChild variant="elevated">
            <Link href="/profile?tab=payouts">
              Open Payouts
              <ExternalLink className="ml-2 h-4 w-4 opacity-70" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
