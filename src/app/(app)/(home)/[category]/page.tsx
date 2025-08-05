import { TenantsList } from "@/modules/tenants/ui/components/tenants-list";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ category: string }>;
}

const Page = async ({ params }: Props) => {
  const { category } = await params;

  return (
    <div>
      <h1>Category: {category}</h1>
      <TenantsList category={category} />
    </div>
  );
};

export default Page;
