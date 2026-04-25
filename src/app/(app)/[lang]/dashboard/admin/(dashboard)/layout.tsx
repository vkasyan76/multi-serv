import "server-only";

import AdminDashboardNavbar from "@/modules/admin/ui/components/admin_dashboard/admin-dashboard-navbar";

export default function AdminDashboardSectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
