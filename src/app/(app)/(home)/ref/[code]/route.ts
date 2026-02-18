import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import {
  REFERRAL_CAPTURE_ENABLED,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_TTL_SECONDS,
  REFERRAL_NOTICE_COOKIE,
  REFERRAL_NOTICE_TTL_SECONDS,
} from "@/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,64}$/;

type ReferralNotice = "invalid" | `expired:${string}`;

type PromotionWindowDoc = {
  startsAt?: string | null;
  endsAt?: string | null;
};

function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\s+/g, "-").toUpperCase();
  return REFERRAL_CODE_RE.test(normalized) ? normalized : null;
}

function isWithinWindow(doc: PromotionWindowDoc, nowMs: number): boolean {
  const startMs = doc.startsAt
    ? Date.parse(String(doc.startsAt))
    : Number.NEGATIVE_INFINITY;
  const endMs = doc.endsAt
    ? Date.parse(String(doc.endsAt))
    : Number.POSITIVE_INFINITY;

  if (doc.startsAt && !Number.isFinite(startMs)) return false;
  if (doc.endsAt && !Number.isFinite(endMs)) return false;

  // Match resolver semantics: startsAt <= now < endsAt.
  return nowMs >= startMs && nowMs < endMs;
}

function redirectToHome(req: NextRequest): NextResponse {
  const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  try {
    return NextResponse.redirect(new URL("/", base ?? req.url));
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

function setReferralCookie(res: NextResponse, code: string) {
  const isProd = process.env.NODE_ENV === "production";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();

  res.cookies.set(REFERRAL_COOKIE, code, {
    path: "/",
    sameSite: "lax",
    secure: isProd,
    maxAge: REFERRAL_COOKIE_TTL_SECONDS,
    ...(isProd && root ? { domain: `.${root}` } : {}),
  });
}

function setNoticeCookie(res: NextResponse, notice: ReferralNotice) {
  const isProd = process.env.NODE_ENV === "production";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();

  res.cookies.set(REFERRAL_NOTICE_COOKIE, notice, {
    path: "/",
    sameSite: "lax",
    secure: isProd,
    httpOnly: true,
    maxAge: REFERRAL_NOTICE_TTL_SECONDS,
    ...(isProd && root ? { domain: `.${root}` } : {}),
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const res = redirectToHome(req);

  // Global rollout/rollback switch: disabled means smart links are no-op redirects.
  if (!REFERRAL_CAPTURE_ENABLED) return res;

  // First-touch wins; never overwrite existing referral attribution.
  const existingReferral = req.cookies.get(REFERRAL_COOKIE)?.value?.trim();
  if (existingReferral) return res;

  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) {
    setNoticeCookie(res, "invalid");
    return res;
  }

  // Pure attribution: capture valid code regardless of campaign status.
  setReferralCookie(res, normalizedCode);

  // Campaign status is message-only here.
  try {
    const payload = await getPayload({ config });
    const found = await payload.find({
      collection: "promotions",
      where: {
        and: [
          { active: { equals: true } },
          { scope: { equals: "referral" } },
          { referralCode: { equals: normalizedCode } },
        ],
      },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    });

    const nowMs = Date.now();
    const hasActiveInWindow = ((found.docs ?? []) as PromotionWindowDoc[]).some(
      (doc) => isWithinWindow(doc, nowMs),
    );

    // Message-only signal for UX; capture remains pure attribution.
    if (!hasActiveInWindow) {
      setNoticeCookie(res, `expired:${normalizedCode}`);
    }
  } catch (err) {
    // Keep attribution flow resilient if promo lookup fails.
    console.warn("[referral] promo status lookup failed in /ref route", err);
  }

  return res;
}
