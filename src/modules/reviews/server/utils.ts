// src/modules/reviews/server/utils.ts
import type { TRPCContext } from "@/trpc/init";

export async function getPayloadUserIdOrNull(
  db: TRPCContext["db"],
  clerkUserId: string | null | undefined
): Promise<string | null> {
  if (!clerkUserId) return null;

  const me = await db.find({
    collection: "users",
    where: { clerkUserId: { equals: clerkUserId } },
    limit: 1,
    depth: 0,
  });

  const payloadUserId = (me.docs?.[0] as { id?: string } | undefined)?.id;
  return payloadUserId ?? null;
}
