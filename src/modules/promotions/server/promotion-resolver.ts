import "server-only";

import {
  COMMISSION_RATE_BPS_DEFAULT,
  PROMOTIONS_RESOLVER_MAX_ACTIVE,
  PROMO_RULE_ID_DEFAULT,
} from "@/constants";
import type { TRPCContext } from "@/trpc/init";
import type { FirstNScope } from "./counter-key";

type PromotionType = "first_n" | "time_window_rate";
type PromotionScope = "global" | "tenants" | "referral";

type PromotionDoc = {
  id: string;
  type?: PromotionType | null;
  scope?: PromotionScope | null;
  priority?: number | null;
  rateBps?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  tenantIds?: Array<string | { id?: string }> | null;
  referralCode?: string | null;
  firstNLimit?: number | null;
  firstNScope?: FirstNScope | null;
  createdAt?: string | null;
};

export type WinningPromotion = {
  id: string;
  type: PromotionType;
  scope: PromotionScope;
  rateBps: number;
  priority: number;
  firstNLimit?: number;
  firstNScope?: FirstNScope;
  ruleId: string;
};

export type ResolvePromotionInput = {
  tenantId: string;
  referralCode?: string | null;
  nowIso?: string;
};

export type ResolvePromotionResult = {
  winningPromotion: WinningPromotion | null;
  ruleId: string;
  effectiveRateBps: number;
  // first_n in Phase 2A is only "eligible pending reservation".
  // Reservation/consumption semantics are handled in Phase 3.
  requiresReservation: boolean;
};

function normalizeReferralCode(value?: string | null): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

function relId(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") return input;
  // Defensive null check for unknown relationship shapes.
  if (typeof input === "object" && input !== null && "id" in input) {
    const raw = (input as { id?: unknown }).id;
    return typeof raw === "string" ? raw : null;
  }
  return null;
}

function isWithinWindow(doc: PromotionDoc, nowMs: number): boolean {
  const startMs = doc.startsAt ? Date.parse(doc.startsAt) : Number.NEGATIVE_INFINITY;
  const endMs = doc.endsAt ? Date.parse(doc.endsAt) : Number.POSITIVE_INFINITY;

  if (doc.startsAt && !Number.isFinite(startMs)) return false;
  if (doc.endsAt && !Number.isFinite(endMs)) return false;

  // End is exclusive by contract: startsAt <= now < endsAt.
  return nowMs >= startMs && nowMs < endMs;
}

function matchesScope(
  doc: PromotionDoc,
  tenantId: string,
  referralCodeNorm: string,
): boolean {
  if (doc.scope === "global") return true;

  if (doc.scope === "tenants") {
    return (doc.tenantIds ?? []).some((item) => relId(item) === tenantId);
  }

  if (doc.scope === "referral") {
    return (
      referralCodeNorm.length > 0 &&
      normalizeReferralCode(doc.referralCode) === referralCodeNorm
    );
  }

  return false;
}

function comparePromotions(a: PromotionDoc, b: PromotionDoc): number {
  const aPriority = Number(a.priority ?? 0);
  const bPriority = Number(b.priority ?? 0);

  if (aPriority !== bPriority) return bPriority - aPriority;

  const aCreatedAt = a.createdAt
    ? Date.parse(a.createdAt)
    : Number.POSITIVE_INFINITY;
  const bCreatedAt = b.createdAt
    ? Date.parse(b.createdAt)
    : Number.POSITIVE_INFINITY;

  // Keep comparator stable even if malformed createdAt slips into storage.
  const aSafe = Number.isFinite(aCreatedAt) ? aCreatedAt : Number.POSITIVE_INFINITY;
  const bSafe = Number.isFinite(bCreatedAt) ? bCreatedAt : Number.POSITIVE_INFINITY;

  if (aSafe !== bSafe) return aSafe - bSafe;

  return String(a.id).localeCompare(String(b.id));
}

function toWinningPromotion(doc: PromotionDoc): WinningPromotion | null {
  if (!doc.id || !doc.type || !doc.scope) return null;

  // Reject null/undefined explicitly (Number(null) would incorrectly coerce to 0).
  if (doc.rateBps == null) return null;
  const rateBps = Number(doc.rateBps);
  // Defend against dirty data even if schema validation exists.
  if (!Number.isFinite(rateBps) || !Number.isInteger(rateBps) || rateBps < 0)
    return null;

  if (doc.type === "first_n") {
    const firstNLimit = Number(doc.firstNLimit);
    const firstNScope = doc.firstNScope;

    // Keep resolver truthful: skip misconfigured first_n campaigns.
    if (
      !Number.isFinite(firstNLimit) ||
      !Number.isInteger(firstNLimit) ||
      firstNLimit < 1
    ) {
      return null;
    }

    if (firstNScope !== "global" && firstNScope !== "per_tenant") {
      return null;
    }

    return {
      id: doc.id,
      type: doc.type,
      scope: doc.scope,
      rateBps,
      priority: Number(doc.priority ?? 0),
      firstNLimit,
      firstNScope,
      ruleId: `promo:${doc.id}`,
    };
  }

  return {
    id: doc.id,
    type: doc.type,
    scope: doc.scope,
    rateBps,
    priority: Number(doc.priority ?? 0),
    ruleId: `promo:${doc.id}`,
  };
}

// Phase 2A selector only: no DB writes, no counter/allocation mutations.
export async function resolvePromotionForCheckout(
  ctx: TRPCContext,
  input: ResolvePromotionInput,
): Promise<ResolvePromotionResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  if (!Number.isFinite(nowMs)) {
    throw new Error("Invalid nowIso for promotion resolver.");
  }

  const referralCodeNorm = normalizeReferralCode(input.referralCode);

  const promosRes = await ctx.db.find({
    collection: "promotions",
    where: {
      and: [
        { active: { equals: true } },
        { currency: { equals: "eur" } },
      ],
    },
    // MVP assumption: bounded active campaign set.
    limit: PROMOTIONS_RESOLVER_MAX_ACTIVE,
    depth: 0,
    overrideAccess: true,
  });

  const candidates = ((promosRes.docs ?? []) as PromotionDoc[])
    .filter((doc) => isWithinWindow(doc, nowMs))
    .filter((doc) => matchesScope(doc, input.tenantId, referralCodeNorm))
    .sort(comparePromotions);

  let winningPromotion: WinningPromotion | null = null;
  for (const doc of candidates) {
    const converted = toWinningPromotion(doc);
    if (!converted) continue;
    winningPromotion = converted;
    break;
  }

  if (!winningPromotion) {
    return {
      winningPromotion: null,
      ruleId: PROMO_RULE_ID_DEFAULT,
      effectiveRateBps: COMMISSION_RATE_BPS_DEFAULT,
      requiresReservation: false,
    };
  }

  return {
    winningPromotion,
    ruleId: winningPromotion.ruleId,
    effectiveRateBps: winningPromotion.rateBps,
    requiresReservation: winningPromotion.type === "first_n",
  };
}

