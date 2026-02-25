import "server-only";
import { notFound } from "next/navigation";

import { isSuperAdmin } from "@/lib/access";
import AdminDashboardNavbar from "@/modules/admin/ui/components/admin_dashboard/admin-dashboard-navbar";
import { caller } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await caller.auth.session();

  if (!isSuperAdmin(session?.user ?? null)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <AdminDashboardNavbar />

      <main className="flex-1">
        <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
