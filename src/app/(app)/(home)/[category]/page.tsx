interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ category: string }>;
}

const Page = async ({ params }: Props) => {
  const { category } = await params;

  return <div>Category: {category}</div>;
};

export default Page;
