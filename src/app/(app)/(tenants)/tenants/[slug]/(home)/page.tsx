import TenantContent from "@/modules/tenants/ui/components/tenant_page/tenant-content";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TenantPage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <TenantContent slug={slug} />
    </div>
  );
}
