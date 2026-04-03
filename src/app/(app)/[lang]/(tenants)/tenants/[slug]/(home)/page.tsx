// import BridgeAuth from "@/modules/tenants/ui/components/tenant_page/BridgeAuth";
import TenantContent from "@/modules/tenants/ui/components/tenant_page/tenant-content";

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export default async function TenantPage({ params }: Props) {
  const { lang, slug } = await params;

  return (
    <div className="py-8">
      {/* <BridgeAuth /> */}
      <TenantContent slug={slug} routeLang={lang} />
    </div>
  );
}
