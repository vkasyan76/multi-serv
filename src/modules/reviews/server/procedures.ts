import { createTRPCRouter, clerkProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const reviewsRouter = createTRPCRouter({
  getMineForTenant: clerkProcedure
    .input(z.object({ slug: z.string() }))
    .query(
      async ({ ctx, input }: { ctx: TRPCContext; input: { slug: string } }) => {
        const { db, userId } = ctx;

        const t = await db.find({
          collection: "tenants",
          where: { slug: { equals: input.slug } },
          limit: 1,
        });
        const tenant = t.docs[0];
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

        const rev = await db.find({
          collection: "reviews",
          where: {
            and: [
              { tenant: { equals: tenant.id } },
              { author: { equals: userId! } },
            ],
          },
          limit: 1,
        });

        return rev.docs[0] ?? null;
      }
    ),

  create: clerkProcedure
    .input(
      z.object({
        slug: z.string(),
        rating: z.number().min(1).max(5),
        title: z.string().min(3).max(120),
        body: z.string().min(10).max(5000),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: { slug: string; rating: number; title: string; body: string };
      }) => {
        const { db, userId } = ctx;

        const t = await db.find({
          collection: "tenants",
          where: { slug: { equals: input.slug } },
          limit: 1,
        });
        const tenant = t.docs[0];
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

        const hasPaid = await db.find({
          collection: "orders",
          where: {
            and: [
              { status: { equals: "paid" } },
              { user: { equals: userId! } },
              {
                or: [
                  {
                    "slots.serviceSnapshot.tenantSlug": { equals: tenant.slug },
                  },
                  { "slots.tenant": { equals: tenant.id } },
                ],
              },
            ],
          },
          limit: 1,
        });
        if (!hasPaid.totalDocs) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can review this provider only after a paid order.",
          });
        }

        const existing = await db.find({
          collection: "reviews",
          where: {
            and: [
              { tenant: { equals: tenant.id } },
              { author: { equals: userId! } },
            ],
          },
          limit: 1,
        });
        if (existing.totalDocs) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You have already reviewed this provider.",
          });
        }

        return db.create({
          collection: "reviews",
          data: {
            tenant: tenant.id,
            tenantSlug: tenant.slug,
            author: userId!,
            rating: input.rating,
            title: input.title,
            body: input.body,
          },
          overrideAccess: true,
        });
      }
    ),
});
