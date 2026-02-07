import { clerkProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Where } from "payload";
import type { Message, User } from "@payload-types";
import { sendDomainEmail } from "@/modules/email/events";
import { generateTenantUrl } from "@/lib/utils";

const getRelId = (v: unknown) =>
  typeof v === "string" ? v : ((v as { id?: string } | null)?.id ?? null);

// Absolute URL for email CTAs (APP_URL -> NEXT_PUBLIC_APP_URL -> localhost).
const toAbsolute = (path: string) => {
  const base =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return new URL(path, base).toString();
};

// Deliverability status for suppression checks (same policy as other email sends).
const toEmailDeliverability = (user: User | null | undefined) => {
  if (!user) return undefined;
  return {
    status: user.emailDeliverabilityStatus ?? undefined,
    reason: user.emailDeliverabilityReason ?? undefined,
    retryAfter: user.emailDeliverabilityRetryAfter ?? undefined,
  };
};

// Consistent display name fallback: first/last -> username -> email.
const displayNameFromUser = (user: User | null | undefined) => {
  if (!user) return "Someone";
  const first = (user.firstName ?? "").trim();
  const last = (user.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const username = (user.username ?? "").trim();
  if (username) return username;
  const email = (user.email ?? "").trim();
  return email || "Someone";
};

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

      // Phase F: debounced message notifications (max 1 / 10m / convo / recipient).
      try {
        const recipientUserId =
          senderRole === "customer" ? tenantUserId : customerId;
        const eventType =
          senderRole === "customer"
            ? "message.received.tenant"
            : "message.received.customer";

        if (recipientUserId) {
          const recipient = (await ctx.db.findByID({
            collection: "users",
            id: recipientUserId,
            depth: 0,
            overrideAccess: true,
          })) as User | null;

          const toEmail = (recipient?.email ?? "").trim();
          if (toEmail) {
            const WINDOW_MS = 10 * 60 * 1000;
            const windowKey = Math.floor(Date.now() / WINDOW_MS);
            // Debounce by windowed entityId; dedupeKey collapses repeats.
            const windowedEntityId = `conversation:${convo.id}:window:${windowKey}`;

            // Customer CTA -> tenant public page (subdomain in prod).
            let ctaUrl = toAbsolute("/");
            if (eventType === "message.received.customer") {
              const tenantId = getRelId(convo.tenant);
              if (tenantId) {
                const tenant = await ctx.db.findByID({
                  collection: "tenants",
                  id: tenantId,
                  depth: 0,
                  overrideAccess: true,
                });
                const slug =
                  typeof tenant?.slug === "string" ? tenant.slug : null;
                if (slug) ctaUrl = toAbsolute(generateTenantUrl(slug));
              }
            } else {
              // Tenant CTA -> messages section in dashboard.
              ctaUrl = toAbsolute("/dashboard#messages");
            }

            await sendDomainEmail({
              db: ctx.db,
              eventType,
              entityType: "message",
              entityId: windowedEntityId,
              recipientUserId,
              toEmail,
              deliverability: toEmailDeliverability(recipient),
              data: {
                // Greeting uses recipient name; "from" uses sender name.
                recipientName: displayNameFromUser(recipient),
                senderName: displayNameFromUser(me as User),
                messagePreview: String(msg.text ?? "").slice(0, 240),
                ctaUrl,
              },
            });
          }
        }
      } catch (err) {
        // Non-blocking by design, but log for visibility.
        console.warn("[email] message.received send failed", err);
      }

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
      // Hide deleted text in list response
      const items = [...pageDocs].reverse().map((m) => {
        const mm = m as Message & { deletedAt?: string | null };
        return mm.deletedAt ? { ...mm, text: "" } : mm;
      });

      return { items, nextCursor };
    }),

  edit: clerkProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        text: z.string().trim().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1) me
      const meRes = await ctx.db.find({
        collection: "users",
        limit: 1,
        where: { clerkUserId: { equals: ctx.userId } },
        depth: 0,
        overrideAccess: true,
      });
      const me = meRes.docs[0];
      if (!me)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User profile not found in Payload.",
        });

      // 2) message
      const msgRes = await ctx.db.find({
        collection: "messages",
        limit: 1,
        where: { id: { equals: input.messageId } },
        depth: 0,
        overrideAccess: true,
      });
      const msg = msgRes.docs[0] as
        | (Message & { deletedAt?: string | null })
        | undefined;
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      if (msg.deletedAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Message is deleted.",
        });

      // 3) conversation (participant gate)
      const convoId = getRelId(msg.conversation);
      const convoRes = await ctx.db.find({
        collection: "conversations",
        limit: 1,
        where: { id: { equals: convoId ?? "" } },
        depth: 0,
        overrideAccess: true,
      });
      const convo = convoRes.docs[0];
      if (!convo)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found.",
        });

      const customerId = getRelId(convo.customer);
      const tenantUserId = getRelId(convo.tenantUser);
      if (me.id !== customerId && me.id !== tenantUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not a participant.",
        });
      }

      // 4) owner-only
      const senderUserId = getRelId(msg.senderUser);
      if (senderUserId !== me.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own messages.",
        });
      }

      // 5) update message
      const updated = await ctx.db.update({
        collection: "messages",
        id: msg.id,
        data: { text: input.text },
        depth: 0,
        overrideAccess: true,
      });

      // 6) update convo preview if this is the "last message"
      if (convo.lastMessageAt && convo.lastMessageAt === msg.createdAt) {
        await ctx.db.update({
          collection: "conversations",
          id: convo.id,
          data: { lastMessagePreview: input.text.slice(0, 120) },
          depth: 0,
          overrideAccess: true,
        });
      }

      return updated;
    }),

  remove: clerkProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const meRes = await ctx.db.find({
        collection: "users",
        limit: 1,
        where: { clerkUserId: { equals: ctx.userId } },
        depth: 0,
        overrideAccess: true,
      });
      const me = meRes.docs[0];
      if (!me)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User profile not found in Payload.",
        });

      const msgRes = await ctx.db.find({
        collection: "messages",
        limit: 1,
        where: { id: { equals: input.messageId } },
        depth: 0,
        overrideAccess: true,
      });
      const msg = msgRes.docs[0] as
        | (Message & { deletedAt?: string | null })
        | undefined;
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      if (msg.deletedAt) return msg; // idempotent

      const convoId = getRelId(msg.conversation);
      const convoRes = await ctx.db.find({
        collection: "conversations",
        limit: 1,
        where: { id: { equals: convoId ?? "" } },
        depth: 0,
        overrideAccess: true,
      });
      const convo = convoRes.docs[0];
      if (!convo)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found.",
        });

      const customerId = getRelId(convo.customer);
      const tenantUserId = getRelId(convo.tenantUser);
      if (me.id !== customerId && me.id !== tenantUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not a participant.",
        });
      }

      const senderUserId = getRelId(msg.senderUser);
      if (senderUserId !== me.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own messages.",
        });
      }

      const now = new Date().toISOString();

      const updated = await ctx.db.update({
        collection: "messages",
        id: msg.id,
        data: { deletedAt: now },
        depth: 0,
        overrideAccess: true,
      });

      if (convo.lastMessageAt && convo.lastMessageAt === msg.createdAt) {
        await ctx.db.update({
          collection: "conversations",
          id: convo.id,
          data: { lastMessagePreview: "Message deleted" },
          depth: 0,
          overrideAccess: true,
        });
      }

      return updated;
    }),
});
