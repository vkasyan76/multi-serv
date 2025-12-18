// src/app/(app)/(tenants)/tenants/[slug]/dashboard/page.tsx
import DashboardContent from "@/modules/tenants/ui/components/tenant_dashboard/dashboard-content";
// import Image from "next/image";
import { LayoutDashboard } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

function toTitleCaseFromSlug(slug: string) {
  // "valentisimo" -> "Valentisimo"
  // "react_jedi" -> "React Jedi"
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function TenantDashboard({ params }: Props) {
  const { slug } = await params;
  const tenantName = toTitleCaseFromSlug(slug);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold inline-flex items-center gap-3">
        {/* <Image
          src="/SVGs/Dashboard/Dashboard_Icon.svg"
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
          className="opacity-90 w-8 h-8 sm:w-10 sm:h-10"
        /> */}
        <LayoutDashboard className="opacity-90 w-8 h-8 sm:w-10 sm:h-10" />
        <span>{tenantName}&apos;s Dashboard</span>
      </h1>

      <DashboardContent slug={slug} />
    </div>
  );
}
