import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { isBefore, addHours, startOfHour, isEqual } from "date-fns";
import type { Booking, Tenant, User } from "@/payload-types";

// Payload returns docs with an id. Make that explicit.
type DocWithId<T> = T & { id: string };

// Convenience return types
type BookSlotsResult = {
  bookedIds: string[];
  unavailableIds: string[];
  invalidIds: string[];
  updated: number;
};

// Booking with computed name (dashboard only) - matches TenantCalendar type
export type BookingWithName = DocWithId<Booking> & {
  customerName?: string | null;
};

// Derive a human display name from a populated customer ref
const displayNameFromUser = (
  u: User | string | null | undefined
): string | null => {
  if (!u || typeof u === "string") return null;
  return u.username ?? u.email ?? null;
};

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
    .query(async ({ input, ctx }): Promise<Array<DocWithId<Booking>>> => {
      // Find tenant by slug
      const tenants = (await ctx.db.find({
        collection: "tenants",
        where: { slug: { equals: input.tenantSlug } },
        limit: 1,
        depth: 0,
      })) as { docs: Array<DocWithId<Tenant>> };

      const tenantId = tenants.docs[0]?.id;
      if (!tenantId) return [];

      // Find overlapping bookings with inclusive boundaries
      const res = (await ctx.db.find({
        collection: "bookings",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { start: { less_than_equal: input.to } },
            { end: { greater_than_equal: input.from } },
            {
              or: [
                { status: { equals: "available" } },
                { status: { equals: "booked" } },
                { status: { equals: "confirmed" } },
              ],
            },
          ],
        },
        sort: "start",
        limit: 1000,
        depth: 0,
      })) as { docs: Array<DocWithId<Booking>> };

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
    .query(async ({ input, ctx }): Promise<Array<BookingWithName>> => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Map Clerk → Payload user id
      const me = (await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      })) as { docs: Array<DocWithId<User>> };
      const payloadUserId = me.docs[0]?.id;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Verify ownership
      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: input.tenantId,
        depth: 0,
        overrideAccess: true,
      })) as Tenant | null;

      const ownerId =
        typeof tenant?.user === "string" ? tenant?.user : tenant?.user?.id;
      if (!ownerId || ownerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Get all slots (available + confirmed) for owner view, excluding past available
      const nowIso = new Date().toISOString();
      const res = (await ctx.db.find({
        collection: "bookings",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { start: { less_than_equal: input.to } },
            { end: { greater_than_equal: input.from } },
            {
              or: [
                { status: { equals: "booked" } },
                { status: { equals: "confirmed" } },
                {
                  and: [
                    { status: { equals: "available" } },
                    { start: { greater_than: nowIso } },
                  ],
                },
              ],
            },
          ],
        },
        overrideAccess: true, // ← bypass read ACL for owner dashboard
        limit: 500,
        depth: 1, // resolve customer relation for name display
      })) as {
        docs: Array<DocWithId<Booking & { customer?: User | string | null }>>;
      };

      // compute customerName
      const withNames: Array<BookingWithName> = res.docs.map((b) => ({
        ...b,
        customerName: displayNameFromUser(b.customer ?? null),
      }));

      return withNames;
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
    .mutation(async ({ input, ctx }): Promise<DocWithId<Booking>> => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Clerk -> Payload user
      const me = (await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      })) as { docs: Array<DocWithId<User>> };
      const payloadUserId = me.docs[0]?.id;
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
          message: "Start must be before end",
        });
      }

      // Snap both to hour
      start.setMinutes(0, 0, 0);
      end.setMinutes(0, 0, 0);

      // Exactly 60 minutes
      if (end.getTime() - start.getTime() !== 60 * 60 * 1000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duration must be 60 minutes",
        });
      }

      // Not in the past
      if (start.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Start must be in the future",
        });
      }

      // Policy: no 23:00 starts (consistent with updateSlotTime)
      if (start.getHours() === 23) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "23:00 not allowed",
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
      })) as DocWithId<Booking>;

      return created;
    }),

  // Book a slot (customer) - FIXED: Race condition prevention + Clerk ID mapping
  bookSlot: baseProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ input, ctx }): Promise<DocWithId<Booking>> => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Map Clerk → Payload user id (same as createAvailableSlot)
      const me = (await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      })) as { docs: Array<DocWithId<User>> };
      const payloadUserId = me.docs[0]?.id;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      const nowIso = new Date().toISOString();
      
      // Atomic conditional update: only book if still available and in the future
      const res = await ctx.db.update({
        collection: "bookings",
        where: {
          and: [
            { id: { equals: input.bookingId } },
            { status: { equals: "available" } },
            { start: { greater_than: nowIso } },
          ],
        },
        data: { status: "booked", customer: payloadUserId },
        overrideAccess: true,
        depth: 0,
      });

      // Payload returns { docs: [...] } for update-many
      const updated = Array.isArray(res?.docs)
        ? (res.docs[0] as DocWithId<Booking> | undefined)
        : undefined;

      if (!updated) {
        // Nothing matched our WHERE; someone else won the race, or slot is in the past
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slot already taken or does not exist",
        });
      }

      return updated;
    }),

  // Remove available slot (tenant only) - FIXED: Race condition prevention
  removeSlot: baseProcedure
    .input(z.object({ bookingId: z.string() }))
    .mutation(async ({ input, ctx }): Promise<{ deletedId: string }> => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Clerk → Payload user
      const me = (await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      })) as { docs: Array<DocWithId<User>> };
      const payloadUserId = me.docs[0]?.id;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Load booking for ownership verification (we still need this for tenant check)
      const b = (await ctx.db.findByID({
        collection: "bookings",
        id: input.bookingId,
        depth: 0,
      })) as Booking | null;
      if (!b) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify tenant ownership
      const tenantId = typeof b.tenant === "string" ? b.tenant : b.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as Tenant | null;

      const ownerId =
        typeof tenant?.user === "string" ? tenant?.user : tenant?.user?.id;
      if (!ownerId || ownerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Atomic conditional delete: only delete if still available
      const deleteRes = await ctx.db.delete({
        collection: "bookings",
        where: {
          and: [
            { id: { equals: input.bookingId } },
            { status: { equals: "available" } },
          ],
        },
        overrideAccess: true,
      });

      // Check if deletion was successful
      if (!deleteRes?.docs || deleteRes.docs.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slot already taken or does not exist",
        });
      }

      return { deletedId: input.bookingId };
    }),

  // Move/resize existing slot (tenant only) - atomic update with overlap validation
  updateSlotTime: baseProcedure
    .input(
      z
        .object({
          bookingId: z.string(),
          start: z.string().datetime(),
          end: z.string().datetime(),
        })
        .refine((v) => new Date(v.start) < new Date(v.end), {
          message: "start must be before end",
          path: ["end"],
        })
    )
    .mutation(async ({ input, ctx }): Promise<DocWithId<Booking>> => {
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const start = startOfHour(new Date(input.start));
      const end = startOfHour(new Date(input.end));

      // Policy: exactly 60 minutes, snapped to hour, no 23:00 starts
      if (start.getHours() === 23) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "23:00 not allowed",
        });
      }
      if (!isEqual(addHours(start, 1), end)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duration must be 60 minutes",
        });
      }
      if (isBefore(start, new Date())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Past moves not allowed",
        });
      }

      // Map Clerk → Payload user
      const me = (await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      })) as { docs: Array<DocWithId<User>> };
      const payloadUserId = me.docs[0]?.id;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Load the current booking for ownership verification
      const current = (await ctx.db.findByID({
        collection: "bookings",
        id: input.bookingId,
        depth: 0,
      })) as Booking | null;

      if (!current) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify tenant ownership
      const tenantId =
        typeof current.tenant === "string"
          ? current.tenant
          : current.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as Tenant | null;

      const ownerId =
        typeof tenant?.user === "string" ? tenant?.user : tenant?.user?.id;
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

      // Atomic conditional update: only update if still available
      const updateRes = await ctx.db.update({
        collection: "bookings",
        where: {
          and: [
            { id: { equals: input.bookingId } },
            { status: { equals: "available" } },
          ],
        },
        data: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        overrideAccess: true,
        depth: 0,
      });

      // Check if update was successful
      const updated = Array.isArray(updateRes?.docs)
        ? (updateRes.docs[0] as DocWithId<Booking> | undefined)
        : undefined;

      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slot already taken or does not exist",
        });
      }

      return updated;
    }),

  bookSlots: baseProcedure
    .input(z.object({ bookingIds: z.array(z.string()).min(1) }))
    .mutation(async ({ input, ctx }): Promise<BookSlotsResult> => {
      const { bookingIds } = input;
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Map Clerk → Payload user id
      const me = (await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      })) as { docs: Array<DocWithId<User>> };
      const payloadUserId = me.docs[0]?.id;
      if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

      // Fetch once to know which ids exist and validate they're bookable
      const { docs } = await ctx.db.find({
        collection: "bookings",
        where: { 
          and: [
            { id: { in: bookingIds } },
            { status: { equals: "available" } },
            { start: { greater_than: new Date().toISOString() } }
          ]
        },
        depth: 0,
        limit: bookingIds.length,
      });

      const foundSet = new Set(docs.map((d: DocWithId<Booking>) => d.id));
      const invalidIds: string[] = bookingIds.filter((id) => !foundSet.has(id));
      const bookableIds = Array.from(foundSet);

      if (bookableIds.length === 0) {
        return {
          bookedIds: [],
          unavailableIds: bookingIds.filter(id => !invalidIds.includes(id)),
          invalidIds,
          updated: 0,
        };
      }

      // Atomic bulk update: book all available slots in one operation
      const bulkUpdateRes = await ctx.db.update({
        collection: "bookings",
        where: {
          and: [
            { id: { in: bookableIds } },
            { status: { equals: "available" } },
            { start: { greater_than: new Date().toISOString() } }
          ]
        },
        data: { status: "booked", customer: payloadUserId },
        overrideAccess: true,
        depth: 0,
      });

      const successfullyBooked = Array.isArray(bulkUpdateRes?.docs) 
        ? bulkUpdateRes.docs.map(doc => doc.id)
        : [];

      // Calculate unavailable (bookable but not successfully booked due to race conditions)
      const unavailableIds = bookableIds.filter(id => !successfullyBooked.includes(id));

      return {
        bookedIds: successfullyBooked,
        unavailableIds: [...unavailableIds, ...bookingIds.filter(id => !foundSet.has(id) && !invalidIds.includes(id))],
        invalidIds,
        updated: successfullyBooked.length,
      };
    }),
});
