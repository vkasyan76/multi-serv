"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useRouter } from "next/navigation";
import ReviewForm from "./review-form";

export default function NewReviewView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();

  // gate + hydrate same as before
  const mine = useQuery(trpc.reviews.getMineForTenant.queryOptions({ slug }));

  const create = useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: async () => {
        //  this query (same pattern as your other forms)
        await qc.invalidateQueries({
          queryKey: trpc.reviews.getMineForTenant.queryOptions({ slug })
            .queryKey,
        });
        // if the tenant page reads any review list, invalidate that key too here
        // await qc.invalidateQueries({ queryKey: trpc.tenants.getPublicBySlug.queryOptions({ slug }).queryKey });

        router.replace(`/tenants/${slug}`);
      },
    })
  );

  if (mine.data) {
    router.replace(`/tenants/${slug}`); // already reviewed
    return null;
  }

  return (
    <ReviewForm
      onSubmit={(values) => create.mutate({ slug, ...values })}
      pending={create.isPending}
    />
  );
}
