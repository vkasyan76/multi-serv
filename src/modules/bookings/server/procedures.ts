import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import type { Booking, Tenant } from "@/payload-types";

export const bookingRouter = createTRPCRouter({
  // List available slots for a tenant (public)
  listPublicSlots: baseProcedure
    .input(
      z.object({
        tenantSlug: z.string(),
        from: z.string().datetime(),
        to: z.string().datetime(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Find tenant by slug
      const tenants = await ctx.db.find({
        collection: "tenants",
        where: { slug: { equals: input.tenantSlug } },
        limit: 1,
      });

      const tenantId = tenants.docs[0]?.id;
      if (!tenantId) return [];

             // Find overlapping bookings with inclusive boundaries
       const res = await ctx.db.find({
         collection: "bookings",
         where: {
           and: [
             { tenant: { equals: tenantId } },
             { start: { less_than_equal: input.to } },
             { end: { greater_than_equal: input.from } },
           ],
         },
         limit: 500,
         depth: 0,
       });

      return res.docs;
    }),

  // Create available slot (tenant only)
  createAvailableSlot: baseProcedure
    .input(
      z
        .object({
          tenantId: z.string(),
          start: z.string().datetime(),
          end: z.string().datetime(),
          mode: z.enum(["online", "onsite"]),
        })
        .refine((v) => new Date(v.start) < new Date(v.end), {
          message: "start must be before end",
          path: ["end"],
        })
    )
    .mutation(async ({ input, ctx }) => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Clerk -> Payload user
      const me = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      });
      const payloadUserId = me.docs[0]?.id as string | undefined;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Verify ownership
      const tenantDoc = (await ctx.db.findByID({
        collection: "tenants",
        id: input.tenantId,
        depth: 0,
      })) as Tenant | null;
      if (!tenantDoc)
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      const ownerId =
        typeof tenantDoc.user === "string"
          ? tenantDoc.user
          : tenantDoc.user?.id;

      if (!ownerId || ownerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your tenant" });
      }

      // Prevent overlaps
      const overlap = await ctx.db.find({
        collection: "bookings",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { start: { less_than: input.end } },
            { end: { greater_than: input.start } },
          ],
        },
        limit: 1,
        depth: 0,
      });
      if (overlap.docs.length) {
        throw new TRPCError({ code: "CONFLICT", message: "Overlapping slot" });
      }

      // Create slot (bypass access; we verified ownership)
      const created = (await ctx.db.create({
        collection: "bookings",
        data: {
          tenant: input.tenantId,
          start: input.start,
          end: input.end,
          mode: input.mode,
          status: "available",
        },
        overrideAccess: true,
        depth: 0,
      })) as Booking;

      return { id: created.id };
    }),

  // Book a slot (customer)
  bookSlot: baseProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.auth?.userId;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const existing = await ctx.db.findByID({
        collection: "bookings",
        id: input.bookingId,
      });

      if (!existing || existing.status !== "available") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slot already taken or does not exist",
        });
      }

      const updated = await ctx.db.update({
        collection: "bookings",
        id: input.bookingId,
        data: {
          status: "confirmed",
          customer: userId,
        },
      });

      return { ok: true, bookingId: updated.id };
    }),
});
