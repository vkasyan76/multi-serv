import "server-only";

import type { Payload } from "payload";

import { CANCELLATION_WINDOW_HOURS } from "@/constants";
import type { Booking, Order } from "@/payload-types";

type DocWithId<T> = T & { id: string };

export type SlotOrderCancellationBlockReason =
  | "already_canceled"
  | "order_paid"
  | "not_slot_order"
  | "wrong_service_status"
  | "invoice_exists"
  | "missing_slots"
  | "invalid_slot_dates"
  | "cutoff_passed"
  | "slot_paid";

export type SlotOrderCancelability = {
  cancelable: boolean;
  reason?: SlotOrderCancellationBlockReason;
  firstSlotStart?: string;
  cutoffAt?: string;
  slotIds: string[];
};

function toSlotIds(order: Pick<Order, "slots">): string[] {
  return [
    ...new Set(
      (order.slots ?? [])
        .map((slot) => (typeof slot === "string" ? slot : slot?.id))
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
    ),
  ];
}

function getEarliestSlotStart(slots: Array<Pick<Booking, "start">>) {
  const starts: number[] = [];

  for (const slot of slots) {
    const parsed = Date.parse(slot.start ?? "");
    if (!Number.isFinite(parsed)) return null;
    starts.push(parsed);
  }

  if (!starts.length) return null;

  return new Date(Math.min(...starts));
}

export async function getSlotOrderCancelability(
  payload: Payload,
  order: Pick<
    Order,
    | "id"
    | "slots"
    | "status"
    | "serviceStatus"
    | "invoiceStatus"
    | "lifecycleMode"
  >,
  now = new Date(),
): Promise<SlotOrderCancelability> {
  const slotIds = toSlotIds(order);

  if (order.status === "canceled") {
    return { cancelable: false, reason: "already_canceled", slotIds };
  }

  // Orders use `status` as the payment-state field in this codebase.
  if (order.status === "paid") {
    return { cancelable: false, reason: "order_paid", slotIds };
  }

  if (order.lifecycleMode !== "slot") {
    return { cancelable: false, reason: "not_slot_order", slotIds };
  }

  if (order.serviceStatus !== "scheduled") {
    return { cancelable: false, reason: "wrong_service_status", slotIds };
  }

  if (order.invoiceStatus !== "none") {
    return { cancelable: false, reason: "invoice_exists", slotIds };
  }

  if (!slotIds.length) {
    return { cancelable: false, reason: "missing_slots", slotIds };
  }

  const slotsRes = await payload.find({
    collection: "bookings",
    where: { id: { in: slotIds } },
    limit: slotIds.length,
    depth: 0,
    overrideAccess: true,
  });

  const slots = (slotsRes.docs ?? []) as Array<
    DocWithId<Pick<Booking, "id" | "start" | "paymentStatus">>
  >;

  if (slots.length !== slotIds.length) {
    return { cancelable: false, reason: "missing_slots", slotIds };
  }

  if (slots.some((slot) => slot.paymentStatus === "paid")) {
    return { cancelable: false, reason: "slot_paid", slotIds };
  }

  const firstSlotStartDate = getEarliestSlotStart(slots);
  if (!firstSlotStartDate) {
    return { cancelable: false, reason: "invalid_slot_dates", slotIds };
  }

  const cutoffAtDate = new Date(
    firstSlotStartDate.getTime() -
      CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000,
  );

  if (now >= cutoffAtDate) {
    return {
      cancelable: false,
      reason: "cutoff_passed",
      slotIds,
      firstSlotStart: firstSlotStartDate.toISOString(),
      cutoffAt: cutoffAtDate.toISOString(),
    };
  }

  return {
    cancelable: true,
    slotIds,
    firstSlotStart: firstSlotStartDate.toISOString(),
    cutoffAt: cutoffAtDate.toISOString(),
  };
}
