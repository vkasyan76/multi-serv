import { TRPCError } from "@trpc/server";

export async function resolvePayloadUserId(
  ctx: { db: unknown },
  clerkUserId: string
): Promise<string> {
  const db = ctx.db as {
    find: (args: {
      collection: "users";
      where: { clerkUserId: { equals: string } };
      limit: number;
      depth: number;
    }) => Promise<{ docs?: Array<{ id?: string }> }>;
  };

  const me = await db.find({
    collection: "users",
    where: { clerkUserId: { equals: clerkUserId } },
    limit: 1,
    depth: 0,
  });

  const payloadUserId = me.docs?.[0]?.id;
  if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });
  return payloadUserId;
}
