import "server-only";

import { TRPCError } from "@trpc/server";
import type { Where } from "payload";

import type { Booking } from "@/payload-types";
import type { TRPCContext } from "@/trpc/init";

type DocWithId<T> = T & { id: string };

export type OrderSlotReleaseMode =
  | "preserve_lifecycle"
  | "clear_request_state";

export type OrderSlotReleaseSnapshot = DocWithId<
  Pick<
    Booking,
    | "id"
    | "status"
    | "customer"
    | "service"
    | "serviceStatus"
    | "paymentStatus"
    | "serviceSnapshot"
    | "serviceCompletedAt"
    | "acceptedAt"
    | "disputedAt"
    | "disputeReason"
  >
>;

function relId(
  value: string | { id?: string | null } | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

export function buildOrderSlotReleaseWhere(
  slotIds: string[],
  orderUserId: string,
): Where {
  return {
    and: [
      { id: { in: slotIds } },
      { customer: { equals: orderUserId } },
      {
        or: [
          { status: { equals: "booked" } },
          { status: { equals: "confirmed" } },
        ],
      },
    ],
  };
}

export async function loadOrderSlotsForRelease(
  ctx: Pick<TRPCContext, "db">,
  slotIds: string[],
  orderUserId: string,
): Promise<OrderSlotReleaseSnapshot[]> {
  if (!slotIds.length) return [];

  const res = await ctx.db.find({
    collection: "bookings",
    where: buildOrderSlotReleaseWhere(slotIds, orderUserId),
    limit: slotIds.length,
    depth: 0,
    overrideAccess: true,
  });

  return (res.docs ?? []) as OrderSlotReleaseSnapshot[];
}

function buildReleaseData(mode: OrderSlotReleaseMode) {
  if (mode === "preserve_lifecycle") {
    return {
      status: "available" as const,
      customer: null,
    };
  }

  return {
    status: "available" as const,
    customer: null,
    service: null,
    serviceStatus: null,
    paymentStatus: null,
    serviceSnapshot: {
      serviceName: null,
      serviceSlug: null,
      tenantName: null,
      tenantSlug: null,
      hourlyRate: null,
    },
    serviceCompletedAt: null,
    acceptedAt: null,
    disputedAt: null,
    disputeReason: null,
  };
}

export function isReleasedOrderSlot(
  booking: OrderSlotReleaseSnapshot | null | undefined,
  mode: OrderSlotReleaseMode,
): boolean {
  if (!booking) return false;
  if (booking.status !== "available") return false;
  if (relId(booking.customer) != null) return false;

  if (mode === "preserve_lifecycle") {
    return true;
  }

  return (
    relId(booking.service) == null &&
    booking.serviceStatus == null &&
    booking.paymentStatus == null &&
    (booking.serviceSnapshot == null ||
      (booking.serviceSnapshot.serviceName == null &&
        booking.serviceSnapshot.serviceSlug == null &&
        booking.serviceSnapshot.tenantName == null &&
        booking.serviceSnapshot.tenantSlug == null &&
        booking.serviceSnapshot.hourlyRate == null)) &&
    booking.serviceCompletedAt == null &&
    booking.acceptedAt == null &&
    booking.disputedAt == null &&
    booking.disputeReason == null
  );
}

export async function releaseOrderSlotsToAvailable(
  ctx: Pick<TRPCContext, "db">,
  args: {
    slotIds: string[];
    orderUserId: string;
    mode: OrderSlotReleaseMode;
  },
): Promise<void> {
  const { slotIds, orderUserId, mode } = args;
  if (!slotIds.length) return;

  const updateRes = await ctx.db.update({
    collection: "bookings",
    where: buildOrderSlotReleaseWhere(slotIds, orderUserId),
    data: buildReleaseData(mode),
    overrideAccess: true,
  });

  let releasedCount = Array.isArray(updateRes?.docs)
    ? updateRes.docs.length
    : null;
  let releasedIds = new Set<string>();

  if (Array.isArray(updateRes?.docs)) {
    releasedIds = new Set(
      updateRes.docs
        .filter((booking) =>
          isReleasedOrderSlot(booking as OrderSlotReleaseSnapshot, mode),
        )
        .map((booking) => String((booking as { id?: unknown }).id ?? "")),
    );
  }

  if (releasedCount === null) {
    const verify = await ctx.db.find({
      collection: "bookings",
      where: { id: { in: slotIds } },
      limit: slotIds.length,
      depth: 0,
      overrideAccess: true,
    });

    const released = (verify.docs ?? []).filter((booking) =>
      isReleasedOrderSlot(booking as OrderSlotReleaseSnapshot, mode),
    );
    releasedCount = released.length;
    releasedIds = new Set(
      released.map((booking) => String((booking as { id?: unknown }).id ?? "")),
    );
  }

  if (releasedCount !== slotIds.length) {
    if (process.env.NODE_ENV !== "production") {
      const failedIds = slotIds.filter((id) => !releasedIds.has(id));
      console.error("[orders] release verification mismatch", {
        failedIds,
        releasedCount,
        expected: slotIds.length,
        mode,
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "orders.errors.cancel_release_failed",
    });
  }
}
