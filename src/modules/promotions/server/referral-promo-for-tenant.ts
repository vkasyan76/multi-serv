import "server-only";

import type { Payload } from "payload";
import { PROMOTIONS_RESOLVER_MAX_ACTIVE } from "@/constants";

const REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,64}$/;

// Keep normalization aligned with current auth/ref route semantics.
function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\s+/g, "-").toUpperCase();
  return REFERRAL_CODE_RE.test(normalized) ? normalized : null;
}

type ReferralPromotionDoc = {
  id: string;
  type?: "first_n" | "time_window_rate" | null;
  priority?: number | null;
  rateBps?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
};

export type ReferralPromoForTenantEmail = {
  id: string;
  type: "first_n" | "time_window_rate";
  rateBps: number;
  endsAt: string | null;
};

function isWithinWindow(doc: ReferralPromotionDoc, nowMs: number): boolean {
  const startMs = doc.startsAt ? Date.parse(doc.startsAt) : Number.NEGATIVE_INFINITY;
  const endMs = doc.endsAt ? Date.parse(doc.endsAt) : Number.POSITIVE_INFINITY;

  if (doc.startsAt && !Number.isFinite(startMs)) return false;
  if (doc.endsAt && !Number.isFinite(endMs)) return false;

  // End-exclusive policy: startsAt <= now < endsAt.
  return nowMs >= startMs && nowMs < endMs;
}

function comparePromotions(
  a: ReferralPromotionDoc,
  b: ReferralPromotionDoc,
): number {
  const aPriority = Number(a.priority ?? 0);
  const bPriority = Number(b.priority ?? 0);

  if (aPriority !== bPriority) return bPriority - aPriority;

  const aCreatedAt = a.createdAt
    ? Date.parse(a.createdAt)
    : Number.POSITIVE_INFINITY;
  const bCreatedAt = b.createdAt
    ? Date.parse(b.createdAt)
    : Number.POSITIVE_INFINITY;

  const aSafe = Number.isFinite(aCreatedAt) ? aCreatedAt : Number.POSITIVE_INFINITY;
  const bSafe = Number.isFinite(bCreatedAt) ? bCreatedAt : Number.POSITIVE_INFINITY;

  if (aSafe !== bSafe) return aSafe - bSafe;

  return String(a.id).localeCompare(String(b.id));
}

function toEmailSafePromotion(
  doc: ReferralPromotionDoc,
): ReferralPromoForTenantEmail | null {
  if (doc.type !== "first_n" && doc.type !== "time_window_rate") return null;

  if (doc.rateBps == null) return null;
  const rateBps = Number(doc.rateBps);
  if (!Number.isFinite(rateBps) || !Number.isInteger(rateBps)) return null;
  if (rateBps < 0 || rateBps > 10000) return null;

  if (doc.endsAt != null && !Number.isFinite(Date.parse(doc.endsAt))) return null;

  return {
    id: String(doc.id),
    type: doc.type,
    rateBps,
    endsAt: doc.endsAt ?? null,
  };
}

export async function getReferralPromoForTenantEmail(input: {
  payload: Payload;
  // Phase 0 decision: source must be persisted tenant referral code only.
  referralCodeForTenant: string | null | undefined;
  nowIso?: string;
}): Promise<ReferralPromoForTenantEmail | null> {
  const referralCode = normalizeReferralCode(input.referralCodeForTenant);
  if (!referralCode) return null;

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) return null;

  const found = await input.payload.find({
    collection: "promotions",
    where: {
      and: [
        { active: { equals: true } },
        { scope: { equals: "referral" } },
        { referralCode: { equals: referralCode } },
      ],
    },
    limit: PROMOTIONS_RESOLVER_MAX_ACTIVE,
    depth: 0,
    overrideAccess: true,
  });

  const winner = ((found.docs ?? []) as ReferralPromotionDoc[])
    .filter((doc) => isWithinWindow(doc, nowMs))
    .sort(comparePromotions)
    .find((doc) => toEmailSafePromotion(doc) != null);

  if (!winner) return null;
  return toEmailSafePromotion(winner);
}
