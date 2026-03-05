// src/app/(app)/dashboard/page.tsx
import DashboardContent from "@/modules/tenants/ui/components/tenant_dashboard/dashboard-content";
import TenantMismatchNotice from "@/modules/tenants/ui/components/tenant_dashboard/tenant-mismatch-notice";
import { LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";
import { caller, getQueryClient, trpc } from "@/trpc/server";

type DashboardPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: DashboardPageProps) {
  const { lang } = await paramsPromise;
  const searchParams = await searchParamsPromise;

  // Guard dashboard behind auth so email deep-links prompt sign-in if needed.
  const session = await caller.auth.session();
  if (!session.user) {
    // Preserve query params (e.g., tenant context) so links return correctly.
    const params = new URLSearchParams();
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            params.append(key, entry);
          });
        } else if (value != null) {
          params.set(key, value);
        }
      }
    }
    const suffix = params.toString();
    // Phase 2: preserve locale in post-auth return target.
    const redirectUrl = suffix
      ? `/${lang}/dashboard?${suffix}`
      : `/${lang}/dashboard`;
    redirect(`/${lang}/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }

  const qc = getQueryClient();

  // Fetch "my tenant" from auth context (bridged userId -> getMine)
  const mine = await qc.fetchQuery(trpc.tenants.getMine.queryOptions({}));

  // If user is not a vendor yet (no tenant), send them to vendor onboarding
  if (!mine?.slug) {
    redirect(`/${lang}/profile?tab=vendor`);
  }

  const tenantSlug = mine.slug;
  const expectedTenant = (() => {
    const raw = searchParams?.tenant;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return typeof raw === "string" ? raw : "";
  })().trim();

  // If a tenant context is provided, block mismatched dashboards.
  if (expectedTenant && expectedTenant !== tenantSlug) {
    const params = new URLSearchParams({ tenant: expectedTenant });
    const redirectUrl = `/${lang}/dashboard?${params.toString()}`;
    return (
      <TenantMismatchNotice
        expectedSlug={expectedTenant}
        actualSlug={tenantSlug}
        signInUrl={`/${lang}/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
      />
    );
  }

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
