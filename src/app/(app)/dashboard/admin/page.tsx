import "server-only";
import Link from "next/link";
import { ClipboardList, Settings, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminFinanceSection } from "@/modules/admin/ui/components/admin_dashboard/admin-finance-section";

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-10">
      <section
        id="transactions"
        className="scroll-mt-28 sm:scroll-mt-32 space-y-3"
      >
        <h2 className="text-lg font-semibold inline-flex items-center gap-2 px-1">
          <Wallet className="h-5 w-5 opacity-80" />
          Transactions
        </h2>
        <AdminFinanceSection />
      </section>

      <section
        id="orders"
        className="scroll-mt-28 sm:scroll-mt-32 rounded-lg border bg-white p-5 space-y-3"
      >
        <h2 className="text-lg font-semibold inline-flex items-center gap-2">
          <ClipboardList className="h-5 w-5 opacity-80" />
          Orders
        </h2>
        <p className="text-sm text-muted-foreground">
          Placeholder for future order analytics: categories, users, locations,
          prices, statuses, and related filters.
        </p>
      </section>

      <section
        id="payload"
        className="scroll-mt-28 sm:scroll-mt-32 rounded-lg border bg-white p-5 space-y-3"
      >
        <h2 className="text-lg font-semibold inline-flex items-center gap-2">
          <Settings className="h-5 w-5 opacity-80" />
          Payload Admin
        </h2>
        <p className="text-sm text-muted-foreground">
          Open Payload CMS for collections and operational admin tasks.
        </p>
        <Button asChild>
          <Link href="/admin">Open Payload Admin</Link>
        </Button>
      </section>
    </div>
  );
}
