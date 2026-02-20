import "server-only";

import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type PayloadRequest,
} from "payload";
import type { TRPCContext } from "../../../trpc/init.ts";
import {
  buildPromotionCounterKey,
  type FirstNScope,
} from "../../promotions/server/counter-key.ts";

type TxReq = Partial<PayloadRequest> & { payload: TRPCContext["db"] };

type CounterModelLike = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};

export type ReservePromotionInput = {
  promotionId: string;
  reservationKey: string;
  tenantId?: string;
  firstNScope: FirstNScope;
  limit: number;
  appliedRateBps: number;
  appliedRuleId: string;
  req?: Partial<PayloadRequest>;
};

// Reservation contract:
// - ok: promo spot reserved for this checkout attempt
// - limit_reached: promo is exhausted (fallback path)
// - error: infrastructure/transaction failure (do not silently fallback)
export type ReservationResult =
  | { ok: true; allocationId: string }
  | { ok: false; reason: "limit_reached" }
  | { ok: false; reason: "error"; error: unknown };

const MAX_TX_RETRIES = 3;
const BASE_BACKOFF_MS = 25;
const RETRYABLE_TX_LABELS = new Set([
  "TransientTransactionError",
  "UnknownTransactionCommitResult",
]);

function getCounterModel(ctx: TRPCContext): CounterModelLike | null {
  const dbRoot = ctx.db as unknown as {
    db?: { collections?: Record<string, unknown> };
    collections?: Record<string, unknown>;
  };
  // Validated against Payload 3.35.0:
  // we intentionally read internal Mongo adapter collections for raw
  // findOneAndUpdate + session support in one transaction.
  // Returning null on shape mismatch is intentional.
  const collections = dbRoot.db?.collections ?? dbRoot.collections ?? null;
  if (!collections) return null;

  const model = collections["promotion_counters"];
  if (!model) {
    return null;
  }

  if (
    typeof (model as { findOneAndUpdate?: unknown }).findOneAndUpdate !== "function"
  ) {
    return null;
  }

  return model as CounterModelLike;
}

async function resolveTransactionId(
  req: Partial<PayloadRequest>,
): Promise<number | string | null> {
  let txId = req.transactionID;
  if (txId instanceof Promise) {
    txId = await txId;
  }
  return typeof txId === "string" || typeof txId === "number" ? txId : null;
}

function getSession(
  ctx: TRPCContext,
  txId: number | string,
): unknown | null {
  const dbRoot = ctx.db as unknown as {
    db?: { sessions?: Record<string, unknown> };
    sessions?: Record<string, unknown>;
  };
  const sessions = dbRoot.db?.sessions ?? dbRoot.sessions ?? null;
  if (!sessions) return null;
  return sessions[String(txId)] ?? sessions[txId as keyof typeof sessions] ?? null;
}

function toError(message: string): ReservationResult {
  return { ok: false, reason: "error", error: new Error(message) };
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === 11000) return true;
  const message = String((error as { message?: unknown }).message ?? "");
  return /duplicate key|E11000/i.test(message);
}

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const labels = (error as { errorLabels?: unknown }).errorLabels;
  if (
    Array.isArray(labels) &&
    labels.some((label) => RETRYABLE_TX_LABELS.has(String(label)))
  ) {
    return true;
  }

  const message = String((error as { message?: unknown }).message ?? "");
  return /TransientTransactionError|UnknownTransactionCommitResult/i.test(
    message,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reserveFirstNPromotionOnce(
  ctx: TRPCContext,
  input: ReservePromotionInput,
): Promise<ReservationResult> {
  const promotionId = input.promotionId?.trim();
  if (!promotionId) return toError("promotionId is required.");

  const reservationKey = input.reservationKey?.trim();
  if (!reservationKey) return toError("reservationKey is required.");

  const limit = Number(input.limit);
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1) {
    return toError("limit must be an integer >= 1.");
  }

  const appliedRateBps = Number(input.appliedRateBps);
  if (
    !Number.isFinite(appliedRateBps) ||
    !Number.isInteger(appliedRateBps) ||
    appliedRateBps < 0
  ) {
    return toError("appliedRateBps must be an integer >= 0.");
  }

  const appliedRuleId = input.appliedRuleId?.trim();
  if (!appliedRuleId) return toError("appliedRuleId is required.");

  const tenantId = input.tenantId?.trim();
  if (input.firstNScope === "per_tenant" && !tenantId) {
    return toError("tenantId is required for per_tenant scope.");
  }

  const counterModel = getCounterModel(ctx);
  if (!counterModel) {
    return toError("promotion_counters model is unavailable.");
  }

  const counterKey = buildPromotionCounterKey({
    promotionId,
    firstNScope: input.firstNScope,
    tenantId,
  });

  // Fresh request object per attempt avoids stale transactionID/session reuse.
  const txReq = {
    ...(input.req ?? {}),
    payload: ctx.db,
  } as TxReq;
  delete txReq.transactionID;

  const startedHere = await initTransaction(txReq);
  const txId = await resolveTransactionId(txReq);
  if (!txId) {
    return toError("Failed to start transaction for reservation.");
  }

  const session = getSession(ctx, txId);
  if (!session) {
    return toError("Missing Mongo session for reservation transaction.");
  }

  const nowIso = new Date().toISOString();
  const tenantRef = input.firstNScope === "per_tenant" ? tenantId : undefined;

  try {
    // Idempotency guard: if the same checkout attempt retries, return existing result
    // and never consume another promo spot.
    const existing = await ctx.db.find({
      collection: "promotion_allocations",
      req: txReq,
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: {
        reservationKey: { equals: reservationKey },
      },
    });

    const existingAllocation = existing.docs?.[0];
    if (existingAllocation?.id) {
      if (startedHere) await commitTransaction(txReq);
      return { ok: true, allocationId: String(existingAllocation.id) };
    }

    const counterDoc = (await counterModel.findOneAndUpdate(
      { counterKey },
      {
        $setOnInsert: {
          counterKey,
          promotion: promotionId,
          ...(tenantRef ? { tenant: tenantRef } : {}),
          // Initialized from promo config on first insert; gate uses stored counter limit.
          limit,
          used: 0,
          active: true,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session,
      },
    )) as { limit?: unknown } | null;

    const storedLimit = Number(counterDoc?.limit);
    if (!Number.isFinite(storedLimit) || storedLimit < 1) {
      throw new Error(
        `Invalid counter limit for reservation (promotionId=${promotionId}, counterKey=${counterKey}, limit=${String(counterDoc?.limit)})`,
      );
    }

    if (storedLimit !== limit) {
      const payloadLogger = (
        txReq.payload as unknown as {
          logger?: { warn?: (message: string, meta?: unknown) => void };
        }
      ).logger;
      const meta = { promotionId, counterKey, inputLimit: limit, storedLimit };
      if (typeof payloadLogger?.warn === "function") {
        payloadLogger.warn(
          "[promotion-reserve] limit mismatch, enforcing stored counter limit",
          meta,
        );
      } else {
        console.warn(
          "[promotion-reserve] limit mismatch, enforcing stored counter limit",
          meta,
        );
      }
    }

    // Atomic gate: "take exactly one promo spot if used < stored limit".
    const updated = await counterModel.findOneAndUpdate(
      { counterKey, used: { $lt: storedLimit } },
      { $inc: { used: 1 } },
      { new: true, session },
    );

    if (!updated) {
      if (startedHere) await killTransaction(txReq);
      // Business failure: winning first_n is exhausted; caller may apply default fee.
      return { ok: false, reason: "limit_reached" };
    }

    const allocation = await ctx.db.create({
      collection: "promotion_allocations",
      req: txReq,
      overrideAccess: true,
      depth: 0,
      data: {
        promotion: promotionId,
        counterKey,
        reservationKey,
        ...(tenantRef ? { tenant: tenantRef } : {}),
        status: "reserved",
        reservedAt: nowIso,
        appliedRateBps,
        appliedRuleId,
      },
    });

    if (startedHere) await commitTransaction(txReq);

    return { ok: true, allocationId: String(allocation.id) };
  } catch (error) {
    if (startedHere) await killTransaction(txReq);

    // If a parallel retry inserted the same reservationKey first, return that allocation.
    if (isDuplicateKeyError(error)) {
      const existing = await ctx.db.find({
        collection: "promotion_allocations",
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: {
          reservationKey: { equals: reservationKey },
        },
      });
      const existingAllocation = existing.docs?.[0];
      if (existingAllocation?.id) {
        return { ok: true, allocationId: String(existingAllocation.id) };
      }
    }

    // Infrastructure/transaction failure: caller must abort checkout (no silent fallback).
    return { ok: false, reason: "error", error };
  }
}

// Phase 3A reservation primitive: strict transaction + atomic counter gate.
export async function reserveFirstNPromotion(
  ctx: TRPCContext,
  input: ReservePromotionInput,
): Promise<ReservationResult> {
  // Wrapper-level retry is only for transient transaction failures.
  // Business outcomes (ok / limit_reached) are returned immediately.
  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < MAX_TX_RETRIES) {
    attempts += 1;

    const result = await reserveFirstNPromotionOnce(ctx, input);
    if (result.ok) return result;
    if (result.reason === "limit_reached") return result;

    lastError = result.error;
    if (
      !isRetryableTransactionError(result.error) ||
      attempts >= MAX_TX_RETRIES
    ) {
      return { ok: false, reason: "error", error: result.error };
    }

    // Backoff only before the next attempt.
    await sleep(BASE_BACKOFF_MS * attempts);
  }

  return {
    ok: false,
    reason: "error",
    error: lastError ?? new Error("Reservation retry failed."),
  };
}
