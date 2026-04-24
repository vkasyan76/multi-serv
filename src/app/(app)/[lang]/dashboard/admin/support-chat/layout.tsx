import "server-only";

import { getTranslations } from "next-intl/server";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";
import AdminDashboardNavbar from "@/modules/admin/ui/components/admin_dashboard/admin-dashboard-navbar";

export default async function AdminSupportChatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const appLang = normalizeToSupported(lang);
  const t = await getTranslations("supportChatAdmin");

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <AdminDashboardNavbar
        title={t("title")}
        backHref={withLocalePrefix("/dashboard/admin", appLang)}
        backLabel={t("backToDashboard")}
        showSubnav={false}
      />

      <main className="flex-1">
        <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
