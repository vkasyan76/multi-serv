import { clerkProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const conversationsRouter = createTRPCRouter({
  upsertForTenant: clerkProcedure
    .input(z.object({ tenantSlug: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const meRes = await ctx.db.find({
        collection: "users",
        limit: 1,
        where: { clerkUserId: { equals: ctx.userId } },
        depth: 0,
        overrideAccess: true,
      });

      const me = meRes.docs[0];
      if (!me) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "User profile not found in Payload (missing clerkUserId mapping).",
        });
      }

      const tenantRes = await ctx.db.find({
        collection: "tenants",
        limit: 1,
        depth: 0,
        where: { slug: { equals: input.tenantSlug } },
        overrideAccess: true,
      });

      const tenant = tenantRes.docs[0];
      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found.",
        });
      }

      const tenantUserId =
        typeof tenant.user === "string" ? tenant.user : tenant.user?.id;

      if (!tenantUserId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant has no associated user.",
        });
      }

      if (tenantUserId === me.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot start a conversation with yourself.",
        });
      }

      const existing = await ctx.db.find({
        collection: "conversations",
        limit: 1,
        where: {
          and: [
            { tenant: { equals: tenant.id } },
            { customer: { equals: me.id } },
          ],
        },
        depth: 0,
        overrideAccess: true,
      });

      if (existing.docs[0]) return existing.docs[0];

      try {
        return await ctx.db.create({
          collection: "conversations",
          data: {
            tenant: tenant.id,
            customer: me.id,
            tenantUser: tenantUserId,
            status: "open",
          },
          overrideAccess: true,
        });
      } catch (err) {
        // Unique index (tenant, customer) makes this race-safe.
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes("E11000")) throw err;

        const again = await ctx.db.find({
          collection: "conversations",
          limit: 1,
          where: {
            and: [
              { tenant: { equals: tenant.id } },
              { customer: { equals: me.id } },
            ],
          },
          depth: 0,
          overrideAccess: true,
        });

        const doc = again.docs[0];
        if (!doc) throw err;
        return doc;
      }
    }),
});
