import { createTRPCRouter, clerkProcedure, baseProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type {
  Tenant,
  Order,
  Review,
  Booking,
  Category,
  User,
} from "@payload-types";

import { getPayloadUserIdOrNull } from "./utils";

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

        // identify payloaduser based on userId from clerk:
        const payloadUserId = await getPayloadUserIdOrNull(db, userId);
        if (!payloadUserId) return null;

        // Render only the most recent review by this user for this tenant
        const rRes = await db.find({
          collection: "reviews",
          where: {
            tenant: { equals: tenant.id },
            author: { equals: payloadUserId },
          },
          sort: "-updatedAt",
          limit: 1,
          overrideAccess: true,
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

        // identify payloaduser based on userId from clerk:
        const payloadUserId = await getPayloadUserIdOrNull(db, userId);

        const tRes = await db.find({
          collection: "tenants",
          where: { slug: { equals: input.slug } },
          limit: 1,
        });
        const tenant = tRes.docs[0] as Tenant | undefined;
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

        // Load last PAID order for this user+tenant; depth resolves slots → Booking with serviceSnapshot
        // order query to use payloadUserId and only run it if we actually found one:
        let last: Order | undefined = undefined;

        if (payloadUserId) {
          const orderRes = await db.find({
            collection: "orders",
            where: {
              and: [
                { status: { equals: "paid" } },
                { user: { equals: payloadUserId } }, // <- here
                { tenant: { equals: tenant.id } },
              ],
            },
            sort: "-createdAt",
            limit: 1,
            depth: 2,
            overrideAccess: true,
          });

          last = orderRes.docs[0] as Order | undefined;
        }

        // slots are (string | Booking)[]
        const firstSlot = Array.isArray(last?.slots)
          ? (last.slots[0] as Booking | string | undefined)
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

        const payloadUserId = await getPayloadUserIdOrNull(db, userId);
        if (!payloadUserId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User account not found.",
          });
        }

        const tRes = await db.find({
          collection: "tenants",
          where: { slug: { equals: input.slug } },
          limit: 1,
        });

        const tenant = tRes.docs[0] as Tenant | undefined;
        if (!tenant) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Tenant not found",
          });
        }

        // IMPORTANT in your project (Orders.read is superadmin-only)
        const orderCheck = await db.find({
          collection: "orders",
          where: {
            and: [
              { status: { equals: "paid" } },
              { user: { equals: payloadUserId } },
              { tenant: { equals: tenant.id } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });

        if (orderCheck.totalDocs === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only review providers you have purchased from.",
          });
        }

        // 1) If exists -> update (this avoids the “create then catch” path on updates)
        const existing = await db.find({
          collection: "reviews",
          where: {
            tenant: { equals: tenant.id },
            author: { equals: payloadUserId },
          },
          sort: "-updatedAt",
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });

        const current = existing.docs[0] as Review | undefined;

        if (current) {
          return db.update({
            collection: "reviews",
            id: current.id,
            data: {
              rating: input.rating,
              title: input.title,
              body: input.body,
              tenantSlug: tenant.slug,
            },
            overrideAccess: true,
          });
        }

        // 2) Not exists -> create (race-safe fallback kept)
        try {
          return await db.create({
            collection: "reviews",
            data: {
              tenant: tenant.id,
              tenantSlug: tenant.slug,
              author: payloadUserId,
              rating: input.rating,
              title: input.title,
              body: input.body,
            },
            overrideAccess: true,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes("E11000")) throw err;

          const again = await db.find({
            collection: "reviews",
            where: {
              tenant: { equals: tenant.id },
              author: { equals: payloadUserId },
            },
            sort: "-updatedAt",
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });

          const cur = again.docs[0] as Review | undefined;
          if (!cur) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Review exists but could not be loaded for update.",
            });
          }

          return db.update({
            collection: "reviews",
            id: cur.id,
            data: {
              rating: input.rating,
              title: input.title,
              body: input.body,
              tenantSlug: tenant.slug,
            },
            overrideAccess: true,
          });
        }
      }
    ),

  // aggregated summary for public reviews display:

  summaryForTenant: baseProcedure
    .input(getBySlugInput)
    .query(
      async ({
        ctx,
        input,
      }: {
        ctx: TRPCContext;
        input: z.infer<typeof getBySlugInput>;
      }) => {
        const { db } = ctx;

        // We keyed reviews by tenantSlug, so this is simple
        const res = await db.find({
          collection: "reviews",
          where: { tenantSlug: { equals: input.slug } },
          limit: 1000, // plenty for now; adjust if you expect huge volumes
        });

        const docs = res.docs as Review[];

        const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };

        let sum = 0;

        for (const r of docs) {
          const rating = Math.round(r.rating ?? 0);
          if (rating >= 1 && rating <= 5) {
            breakdown[rating as 1 | 2 | 3 | 4 | 5]++;
            sum += rating;
          }
        }

        const totalReviews = docs.length;
        const avgRating = totalReviews > 0 ? sum / totalReviews : 0;

        return {
          avgRating, // e.g. 4.4
          totalReviews,
          breakdown,
        };
      }
    ),

  // review summaries for multiple tenants at once:
  summariesForTenants: baseProcedure
    .input(
      z.object({
        slugs: z.array(z.string()).min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const res = await db.find({
        collection: "reviews",
        where: { tenantSlug: { in: input.slugs } },
        limit: 1000,
      });

      const docs = res.docs as Review[];

      // slug -> aggregate
      const map: Record<string, { avgRating: number; totalReviews: number }> =
        {};

      for (const r of docs) {
        const slug = r.tenantSlug;
        if (!slug) continue;

        const rating = Math.round(r.rating ?? 0);
        if (rating < 1 || rating > 5) continue;

        if (!map[slug]) {
          map[slug] = { avgRating: 0, totalReviews: 0 };
        }
        map[slug].avgRating += rating;
        map[slug].totalReviews += 1;
      }

      // finalize averages
      for (const slug of Object.keys(map)) {
        const entry = map[slug];
        if (!entry) continue; // satisfies TypeScript with no magic
        entry.avgRating =
          entry.totalReviews > 0 ? entry.avgRating / entry.totalReviews : 0;
      }

      return map;
    }),

  listForTenant: baseProcedure
    .input(
      z.object({
        slug: z.string(),
        cursor: z.number().optional(), // page number
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const res = await ctx.db.find({
        collection: "reviews",
        where: { tenantSlug: { equals: input.slug } },
        sort: "-updatedAt",
        page: input.cursor ?? 1,
        limit: input.limit,
        depth: 1, // populate author
        pagination: true,
      });

      const raw = res.docs as Review[];

      /**
       * With a DB-level unique index on (tenant, author), duplicates are impossible.
       * So we DO NOT dedupe here — keeping pagination metadata consistent.
       */

      const docs = raw.map((r) => {
        const a = r.author;
        const user = a && typeof a === "object" ? (a as User) : null;

        const name =
          typeof user?.username === "string" && user.username.trim()
            ? user.username
            : "User";

        // if you DON'T store avatarUrl in DB, keep this null
        const avatarUrl = null;

        return {
          id: r.id,
          rating: r.rating ?? 0,
          title: r.title ?? "",
          body: r.body ?? "",
          createdAt: r.createdAt ?? null,
          author: { name, avatarUrl },
        };
      });

      return {
        docs,
        hasNextPage: res.hasNextPage,
        nextPage: res.hasNextPage ? res.nextPage : undefined,
        page: res.page,
        totalDocs: res.totalDocs,
        totalPages: res.totalPages,
      };
    }),
});
