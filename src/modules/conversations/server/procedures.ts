import { clerkProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Conversation, User, Tenant } from "@payload-types";

// helper to get ID from relation field for list for tenant
const getRelId = (v: unknown) =>
  typeof v === "string" ? v : ((v as { id?: string } | null)?.id ?? null);

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
        const anyErr = err as { code?: number; message?: string };
        const message = anyErr?.message ?? String(err);
        // duplicate detection.
        const isDup =
          anyErr?.code === 11000 ||
          message.includes("E11000") ||
          message.includes("Conversation already exists") ||
          message.includes("duplicate key");
        if (!isDup) throw err;

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

  /** Tenant dashboard inbox */
  listForTenant: clerkProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1),
        cursor: z.number().optional(), // page number
        limit: z.number().min(1).max(30).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Find "me" in Payload users
      const meRes = await ctx.db.find({
        collection: "users",
        limit: 1,
        where: { clerkUserId: { equals: ctx.userId } },
        depth: 0,
        overrideAccess: true,
      });

      const me = meRes.docs[0] as User | undefined;
      if (!me) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "User profile not found in Payload (missing clerkUserId mapping).",
        });
      }

      // Load tenant by slug
      const tRes = await ctx.db.find({
        collection: "tenants",
        limit: 1,
        where: { slug: { equals: input.tenantSlug } },
        depth: 0,
        overrideAccess: true,
      });

      const tenant = tRes.docs[0] as Tenant | undefined;
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

      // Gate: only the tenant owner can see the inbox
      if (tenantUserId !== me.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to view this tenant inbox.",
        });
      }

      // Page through conversations for this tenant
      const page = input.cursor ?? 1;

      const convoRes = await ctx.db.find({
        collection: "conversations",
        where: { tenant: { equals: tenant.id } },
        sort: "-updatedAt", // best effort; see NOTE below
        page,
        limit: input.limit,
        depth: 1, // populate customer
        pagination: true,
        overrideAccess: true,
      });

      const raw = convoRes.docs as Conversation[];

      // MVP: fetch last message for each convo (N+1, OK for small limits)
      const docs = await Promise.all(
        raw.map(async (c) => {
          const customerRel = c.customer;
          const customer =
            customerRel && typeof customerRel === "object"
              ? (customerRel as User)
              : null;

          const customerName =
            typeof customer?.username === "string" && customer.username.trim()
              ? customer.username.trim()
              : "Customer";

          // Now that messages.send updates lastMessageAt/Preview, you don’t need to query messages per conversation anymore.

          return {
            id: c.id,
            customer: {
              id: getRelId(c.customer) ?? "",
              name: customerName,
              avatarUrl: null,
            },
            lastMessage: c.lastMessageAt
              ? {
                  text: c.lastMessagePreview ?? "",
                  createdAt: c.lastMessageAt ?? null,
                  senderRole: null, // not stored on convo (fine for your UI)
                }
              : null,
            updatedAt: c.updatedAt ?? null,
          };
        })
      );

      return {
        docs,
        hasNextPage: convoRes.hasNextPage,
        nextPage: convoRes.hasNextPage ? convoRes.nextPage : undefined,
        page: convoRes.page,
        totalDocs: convoRes.totalDocs,
        totalPages: convoRes.totalPages,
      };
    }),
});
