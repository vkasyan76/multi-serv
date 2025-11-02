import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import NewReviewView from "@/modules/reviews/ui/new-review-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;

  const qc = getQueryClient();
  await qc.prefetchQuery(trpc.reviews.getMineForTenant.queryOptions({ slug }));

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <NewReviewView slug={slug} />
    </HydrationBoundary>
  );
}
