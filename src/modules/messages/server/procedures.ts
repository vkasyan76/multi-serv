import { clerkProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Where } from "payload";
import type { Message } from "@payload-types";

const getRelId = (v: unknown) =>
  typeof v === "string" ? v : ((v as { id?: string } | null)?.id ?? null);

export const messagesRouter = createTRPCRouter({
  send: clerkProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        text: z.string().trim().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find "me" in Payload users
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

      // Load conversation
      const convoRes = await ctx.db.find({
        collection: "conversations",
        limit: 1,
        where: { id: { equals: input.conversationId } },
        depth: 0,
        overrideAccess: true,
      });

      const convo = convoRes.docs[0];
      if (!convo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found.",
        });
      }

      const customerId = getRelId(convo.customer);
      const tenantUserId = getRelId(convo.tenantUser);

      const isCustomer = customerId === me.id;
      const isTenantUser = tenantUserId === me.id;

      if (!isCustomer && !isTenantUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not a participant.",
        });
      }

      const senderRole = isTenantUser ? "tenant" : "customer";

      const msg = await ctx.db.create({
        collection: "messages",
        data: {
          conversation: convo.id,
          senderRole,
          senderUser: me.id,
          text: input.text,
        },
        depth: 0,
        overrideAccess: true,
      });

      // keep conversation “hot” for inbox sorting + preview
      await ctx.db.update({
        collection: "conversations",
        id: convo.id,
        data: {
          lastMessageAt: msg.createdAt,
          lastMessagePreview: msg.text.slice(0, 120),
          status: "open",
        },
        depth: 0,
        overrideAccess: true,
      });

      return msg;
    }),

  list: clerkProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        cursor: z.string().optional(), // ISO createdAt of the OLDEST message currently loaded
        limit: z.coerce.number().min(1).max(50).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      // Find "me"
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

      // Load convo (auth gate)
      const convoRes = await ctx.db.find({
        collection: "conversations",
        limit: 1,
        where: { id: { equals: input.conversationId } },
        depth: 0,
        overrideAccess: true,
      });

      const convo = convoRes.docs[0];
      if (!convo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found.",
        });
      }

      const customerId = getRelId(convo.customer);
      const tenantUserId = getRelId(convo.tenantUser);

      if (me.id !== customerId && me.id !== tenantUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not a participant.",
        });
      }

      // DB query: newest -> older, then we reverse for UI (oldest -> newest)
      const where: Where = {
        and: [{ conversation: { equals: input.conversationId } }],
      };

      if (input.cursor) {
        where.and = [
          ...(where.and ?? []),
          { createdAt: { less_than: input.cursor } },
        ];
      }

      const pageSize = input.limit;

      const res = await ctx.db.find({
        collection: "messages",
        where,
        limit: pageSize + 1, // fetch one extra to detect "has more"
        sort: "-createdAt",
        depth: 0,
        overrideAccess: true,
      });

      const docsDesc = res.docs as Message[];
      const hasMore = docsDesc.length > pageSize;
      const pageDocs = hasMore ? docsDesc.slice(0, pageSize) : docsDesc;
      const last = pageDocs[pageDocs.length - 1];
      const nextCursor = hasMore ? last?.createdAt : undefined; // getNextPageParam in conversation-thread can safely return undefined to stop pagination

      // return ascending so UI can render naturally
      const items = [...pageDocs].reverse();

      return { items, nextCursor };
    }),
});
