// import BridgeAuth from "@/modules/tenants/ui/components/tenant_page/BridgeAuth";
import TenantContent from "@/modules/tenants/ui/components/tenant_page/tenant-content";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TenantPage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="py-8">
      {/* <BridgeAuth /> */}
      <TenantContent slug={slug} />
    </div>
  );
}
