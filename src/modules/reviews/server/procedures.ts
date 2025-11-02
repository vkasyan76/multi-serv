import { createTRPCRouter, clerkProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Tenant, Order, Review, Booking, Category } from "@payload-types";

/** Zod schemas so we can reuse the inferred types in the resolver signatures */
const getBySlugInput = z.object({ slug: z.string() });
const createInput = z.object({
  slug: z.string(),
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(5000),
});

export const reviewsRouter = createTRPCRouter({
  getMineForTenant: clerkProcedure
    .input(getBySlugInput)
    .query(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: z.infer<typeof getBySlugInput>;
      }) => {
        const { db, userId } = ctx;

        const tRes = await db.find({
          collection: "tenants",
          where: { slug: { equals: input.slug } },
          limit: 1,
        });
        const tenant = tRes.docs[0] as Tenant | undefined;
        if (!tenant) return null;

        const rRes = await db.find({
          collection: "reviews",
          where: { tenant: { equals: tenant.id }, author: { equals: userId! } },
          limit: 1,
        });

        return (rRes.docs[0] as Review | undefined) ?? null;
      }
    ),

  /** Context for the header above the form (tenant name + service + last booking date) */
  reviewContext: clerkProcedure
    .input(getBySlugInput)
    .query(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: z.infer<typeof getBySlugInput>;
      }) => {
        const { db, userId } = ctx;

        const tRes = await db.find({
          collection: "tenants",
          where: { slug: { equals: input.slug } },
          limit: 1,
        });
        const tenant = tRes.docs[0] as Tenant | undefined;
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

        // Load last PAID order for this user+tenant; depth resolves slots → Booking with serviceSnapshot
        const orderRes = await db.find({
          collection: "orders",
          where: {
            and: [
              { status: { equals: "paid" } },
              { user: { equals: userId! } },
              { tenant: { equals: tenant.id } },
            ],
          },
          sort: "-createdAt",
          limit: 1,
          depth: 2,
        });

        const last = orderRes.docs[0] as Order | undefined;

        // slots are (string | Booking)[]
        const firstSlot: Booking | string | undefined = Array.isArray(
          last?.slots
        )
          ? (last!.slots[0] as Booking | string | undefined)
          : undefined;

        let when: string | null = null;
        let serviceName: string | null = null;

        if (firstSlot && typeof firstSlot === "object") {
          const slot = firstSlot as Booking;
          when = slot.start ?? null;

          // Booking.service is (string | null) | Category
          if (slot.service && typeof slot.service === "object") {
            serviceName = (slot.service as Category).name ?? null;
          }
        }

        return {
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
          serviceName,
          when,
        };
      }
    ),

  create: clerkProcedure
    .input(createInput)
    .mutation(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: z.infer<typeof createInput>;
      }) => {
        const { db, userId } = ctx;
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Sign in to write a review.",
          });
        }

        const tRes = await db.find({
          collection: "tenants",
          where: { slug: { equals: input.slug } },
          limit: 1,
        });
        const tenant = tRes.docs[0] as Tenant | undefined;
        if (!tenant)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Tenant not found",
          });

        // Optional guard: require at least one PAID order for this (user, tenant)
        // Comment this block out if you want to allow reviews without purchases.
        const orderCheck = await db.find({
          collection: "orders",
          where: {
            and: [
              { status: { equals: "paid" } },
              { user: { equals: userId } },
              { tenant: { equals: tenant.id } },
            ],
          },
          limit: 1,
        });
        const hasPaidOrder = orderCheck.totalDocs > 0;
        if (!hasPaidOrder) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only review providers you have purchased from.",
          });
        }

        // 1 review per (user, tenant): update if exists, else create
        const existing = await db.find({
          collection: "reviews",
          where: { tenant: { equals: tenant.id }, author: { equals: userId } },
          limit: 1,
        });

        if (existing.totalDocs > 0) {
          const current = existing.docs[0] as Review;
          return db.update({
            collection: "reviews",
            id: current.id,
            data: {
              rating: input.rating,
              title: input.title,
              body: input.body,
              tenantSlug: tenant.slug, // keep slug synced if your schema has it
            },
            overrideAccess: true,
          });
        }

        return db.create({
          collection: "reviews",
          data: {
            tenant: tenant.id,
            tenantSlug: tenant.slug, // if present in schema
            author: userId,
            rating: input.rating,
            title: input.title,
            body: input.body,
          },
          overrideAccess: true,
        });
      }
    ),
});
