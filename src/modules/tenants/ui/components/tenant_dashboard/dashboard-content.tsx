"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { TenantMessagesSection } from "@/modules/conversations/ui/tenant-messages-section";

// Heavy calendar (RBC + DnD) – load like on the tenant page to avoid SSR/hydration issues
const TenantCalendar = dynamic(
  () => import("@/modules/bookings/ui/TenantCalendar"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[50vh] bg-muted animate-pulse rounded-lg" />
    ),
  }
);

export default function DashboardContent({ slug }: { slug: string }) {
  return (
    <div className="space-y-12">
      {/* CALENDAR */}
      <section id="calendar" className="scroll-mt-28 sm:scroll-mt-32">
        <h2 className="text-xl font-semibold mb-3">Calendar</h2>
        {/* Dashboard mode → calendar is editable */}
        <TenantCalendar tenantSlug={slug} editable />
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
          <TenantMessagesSection tenantSlug={slug} />
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
