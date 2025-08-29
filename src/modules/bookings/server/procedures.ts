import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { isBefore, addHours, startOfHour, isEqual } from "date-fns";
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

      // Find overlapping bookings with inclusive boundaries (only available slots)
      const res = await ctx.db.find({
        collection: "bookings",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { start: { less_than_equal: input.to } },
            { end: { greater_than_equal: input.from } },
            { status: { equals: "available" } },
          ],
        },
        limit: 500,
        depth: 0,
      });

      return res.docs;
    }),

  // List all slots for tenant owner (dashboard view)
  listMine: baseProcedure
    .input(
      z.object({
        tenantId: z.string(),
        from: z.string().datetime(),
        to: z.string().datetime(),
      })
    )
    .query(async ({ input, ctx }) => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Map Clerk → Payload user id
      const me = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      });
      const payloadUserId = me.docs[0]?.id as string | undefined;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Verify ownership
      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: input.tenantId,
        depth: 0,
        overrideAccess: true,
      })) as Tenant | null;
      
      const ownerId = typeof tenant?.user === "string" ? tenant?.user : tenant?.user?.id;
      if (!ownerId || ownerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Get all slots (available + confirmed) for owner view
      const res = await ctx.db.find({
        collection: "bookings",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { start: { less_than_equal: input.to } },
            { end: { greater_than_equal: input.from } },
          ],
        },
        overrideAccess: true, // ← bypass read ACL for owner dashboard
        limit: 500,
        depth: 0,
      });

      return res.docs as Booking[];
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
        overrideAccess: true,
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

      // Basic sanity check
      const start = new Date(input.start);
      const end = new Date(input.end);

      if (start >= end) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Start must be before end" 
        });
      }

      // Snap both to hour
      start.setMinutes(0, 0, 0);
      end.setMinutes(0, 0, 0);

      // Exactly 60 minutes
      if (end.getTime() - start.getTime() !== 60 * 60 * 1000) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Duration must be 60 minutes" 
        });
      }

      // Not in the past
      if (start.getTime() <= Date.now()) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Start must be in the future" 
        });
      }

      // Use normalized times for overlap check
      const overlap = await ctx.db.find({
        collection: "bookings",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { start: { less_than: end.toISOString() } },
            { end: { greater_than: start.toISOString() } },
          ],
        },
        limit: 1,
        depth: 0,
      });
      if (overlap.docs.length) {
        throw new TRPCError({ code: "CONFLICT", message: "Overlapping slot" });
      }

      // Store normalized UTC
      const created = (await ctx.db.create({
        collection: "bookings",
        data: {
          tenant: input.tenantId,
          start: start.toISOString(),
          end: end.toISOString(),
          mode: input.mode,
          status: "available",
        },
        overrideAccess: true,
        depth: 0,
      })) as Booking;

      return { id: created.id };
    }),

  // Book a slot (customer) - FIXED: Clerk ID mapping + overrideAccess
  bookSlot: baseProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Map Clerk → Payload user id (same as createAvailableSlot)
      const me = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      });
      const payloadUserId = me.docs[0]?.id as string | undefined;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Load booking
      const existing = (await ctx.db.findByID({
        collection: "bookings",
        id: input.bookingId,
        depth: 0,
      })) as Booking | null;

      if (!existing || existing.status !== "available") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slot already taken or does not exist",
        });
      }

      // Confirm booking (bypass collection access after our checks)
      const updated = (await ctx.db.update({
        collection: "bookings",
        id: input.bookingId,
        data: { status: "confirmed", customer: payloadUserId },
        overrideAccess: true, // ← required if you tighten collection update
        depth: 0,
      })) as Booking;

      return { ok: true, bookingId: updated.id };
    }),

  // Remove available slot (tenant only) - NEW: allows cleanup
  removeSlot: baseProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Clerk → Payload user
      const me = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      });
      const payloadUserId = me.docs[0]?.id as string | undefined;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Load booking
      const b = (await ctx.db.findByID({
        collection: "bookings",
        id: input.bookingId,
        depth: 0,
      })) as Booking | null;
      if (!b) throw new TRPCError({ code: "NOT_FOUND" });

      if (b.status !== "available") {
        throw new TRPCError({ 
          code: "CONFLICT", 
          message: "Only available slots can be removed" 
        });
      }

      // Verify tenant ownership
      const tenantId = typeof b.tenant === "string" ? b.tenant : b.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as Tenant | null;

      const ownerId = typeof tenant?.user === "string" ? tenant?.user : tenant?.user?.id;
      if (!ownerId || ownerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Delete (bypass collection ACL)
      await ctx.db.delete({
        collection: "bookings",
        id: b.id,
        overrideAccess: true, // ← required if collection delete is restricted
      });

      return { ok: true };
    }),

  // Move/resize existing slot (tenant only) - atomic update with overlap validation
  updateSlotTime: baseProcedure
    .input(
      z.object({
        bookingId: z.string(),
        start: z.string().datetime(),
        end: z.string().datetime(),
      })
      .refine((v) => new Date(v.start) < new Date(v.end), {
        message: "start must be before end",
        path: ["end"],
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const start = startOfHour(new Date(input.start));
      const end = startOfHour(new Date(input.end));

      // Policy: exactly 60 minutes, snapped to hour, no 23:00 starts
      if (start.getHours() === 23) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "23:00 not allowed" });
      }
      if (!isEqual(addHours(start, 1), end)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Duration must be 60 minutes" });
      }
      if (isBefore(start, new Date())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Past moves not allowed" });
      }

      // Map Clerk → Payload user
      const me = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      });
      const payloadUserId = me.docs[0]?.id as string | undefined;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Load the current booking
      const current = (await ctx.db.findByID({
        collection: "bookings",
        id: input.bookingId,
        depth: 0,
      })) as Booking | null;

      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      if (current.status !== "available") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only available slots are movable" });
      }

      // Verify tenant ownership
      const tenantId = typeof current.tenant === "string" ? current.tenant : current.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as Tenant | null;

      const ownerId = typeof tenant?.user === "string" ? tenant?.user : tenant?.user?.id;
      if (!ownerId || ownerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your tenant" });
      }

      // Overlap guard (same tenant, exclude current booking id)
      const overlapping = await ctx.db.find({
        collection: "bookings",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { id: { not_equals: input.bookingId } },
            { start: { less_than: end.toISOString() } },
            { end: { greater_than: start.toISOString() } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      if (overlapping.docs.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Overlapping slot" });
      }

      // Update the booking time
      const updated = (await ctx.db.update({
        collection: "bookings",
        id: input.bookingId,
        data: { 
          start: start.toISOString(), 
          end: end.toISOString() 
        },
        overrideAccess: true,
        depth: 0,
      })) as Booking;

      return { id: updated.id, start: updated.start, end: updated.end };
    }),
});
