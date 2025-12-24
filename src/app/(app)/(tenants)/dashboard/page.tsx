// src/app/(app)/dashboard/page.tsx
import DashboardContent from "@/modules/tenants/ui/components/tenant_dashboard/dashboard-content";
import { LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";
import { getQueryClient, trpc } from "@/trpc/server";

export default async function DashboardPage() {
  const qc = getQueryClient();

  // Fetch "my tenant" from auth context (bridged userId -> getMine)
  const mine = await qc.fetchQuery(trpc.tenants.getMine.queryOptions({}));

  // If user is not a vendor yet (no tenant), send them to vendor onboarding
  if (!mine?.slug) {
    redirect("/profile?tab=vendor");
  }

  const tenantSlug = mine.slug;
  // minimal: capitalize first letter only
  const rawName = (mine.name ?? tenantSlug).trim();
  const tenantName =
    rawName.length > 0
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
      : tenantSlug;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold inline-flex items-center gap-3">
        <LayoutDashboard className="opacity-90 w-8 h-8 sm:w-10 sm:h-10" />
        <span>{tenantName}&apos;s Dashboard</span>
      </h1>

      <DashboardContent slug={tenantSlug} />
    </div>
  );
}
