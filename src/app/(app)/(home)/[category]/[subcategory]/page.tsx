import { TenantsList } from "@/modules/tenants/ui/components/tenants-list";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ category: string; subcategory: string }>;
}

const Page = async ({ params }: Props) => {
  const { category, subcategory } = await params;

  return (
    <div>
      <h1>Category: {category}</h1>
      <h2>Subcategory: {subcategory}</h2>
      <TenantsList category={category} subcategory={subcategory} />
    </div>
  );
};

export default Page;
