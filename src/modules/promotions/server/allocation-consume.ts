import "server-only";
import type { Payload } from "payload";

type RelValue = string | { id?: string } | null | undefined;

function relId(value: RelValue): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.id === "string") return value.id;
  return null;
}

type AllocationUpdateResult = {
  docs?: unknown[];
  totalDocs?: number;
};

function updatedDocCount(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;
  const typed = result as AllocationUpdateResult;
  if (typeof typed.totalDocs === "number") return typed.totalDocs;
  if (Array.isArray(typed.docs)) return typed.docs.length;
  return null;
}

export async function consumePromotionAllocationIfReserved(params: {
  payload: Payload;
  invoiceId: string;
  invoicePromotionAllocationId?: RelValue;
  fallbackAllocationId?: string | null;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  consumedAt: string;
}): Promise<{
  allocationId: string | null;
  updatedCount: number | null;
}> {
  const allocationId =
    relId(params.invoicePromotionAllocationId) ??
    params.fallbackAllocationId?.trim() ??
    null;

  if (!allocationId) {
    return { allocationId: null, updatedCount: 0 };
  }

  // Idempotent consume: only transition allocations that are still reserved.
  const result = await params.payload.update({
    collection: "promotion_allocations",
    where: {
      and: [
        { id: { equals: allocationId } },
        { status: { equals: "reserved" } },
      ],
    },
    data: {
      status: "consumed",
      consumedAt: params.consumedAt,
      invoice: params.invoiceId,
      stripeCheckoutSessionId: params.stripeCheckoutSessionId,
      stripePaymentIntentId: params.stripePaymentIntentId ?? undefined,
    },
    overrideAccess: true,
  });

  return { allocationId, updatedCount: updatedDocCount(result) };
}
