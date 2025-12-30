import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import type { User } from "@/payload-types";
import { TERMS_VERSION } from "@/constants";

type DocWithId<T> = T & { id: string };

export const legalRouter = createTRPCRouter({
  acceptPolicy: baseProcedure.mutation(async ({ ctx }) => {
    const clerkUserId = ctx.userId;
    if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const me = (await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: clerkUserId } },
      limit: 1,
      depth: 0,
    })) as { docs: Array<DocWithId<User>> };

    const user = me.docs[0];
    if (!user) throw new TRPCError({ code: "FORBIDDEN" });

    const nowIso = new Date().toISOString();

    await ctx.db.update({
      collection: "users",
      id: user.id,
      data: {
        policyAcceptedVersion: TERMS_VERSION,
        policyAcceptedAt: nowIso,
      },
      overrideAccess: true,
      depth: 0,
    });

    return { ok: true, policyAcceptedVersion: TERMS_VERSION };
  }),
});
