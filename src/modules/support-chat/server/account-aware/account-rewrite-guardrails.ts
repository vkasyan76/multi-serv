import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import type {
  SupportAccountHelperDTO,
  SupportAccountRewriteRejectedReason,
} from "./types";

const SYSTEM_CLAIM_PATTERNS = [
  /\b(stripe|payload|mongodb|database|db|payment provider|processor)\b/i,
  /\b(i|we)\s+(checked|looked up|queried|accessed)\s+(your\s+)?(account|database|stripe|payment provider|records?)\b/i,
];

const MUTATION_CLAIM_PATTERNS = [
  /\b(i|we)\s+(cancelled|canceled|refunded|charged|paid|issued|voided|updated|changed)\b/i,
  /\b(has|have)\s+been\s+(cancelled|canceled|refunded|charged|paid|issued|voided|updated|changed)\s+(by\s+me|by\s+us)\b/i,
];

const UNSUPPORTED_FACT_PATTERNS = [
  /\bguarantee(d)?\b/i,
  /\byou\s+will\s+be\s+charged\b/i,
  /\bdefinitely\s+(paid|unpaid|charged|refunded)\b/i,
];

const ENGLISH_BOILERPLATE_PATTERNS = [
  /\bthis order\b/i,
  /\bpayment is\b/i,
  /\binvoice\b/i,
  /\bprovider\b/i,
  /\bcustomer\b/i,
  /\bfrom the recent orders\b/i,
  /\bnot a full payment history\b/i,
];

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function contradictsFallback(input: {
  text: string;
  fallbackAnswer: string;
  helperResult: SupportAccountHelperDTO;
}) {
  const text = input.text.toLowerCase();
  const fallback = input.fallbackAnswer.toLowerCase();

  if (
    input.helperResult.resultCategory === "payment_status" &&
    input.helperResult.paymentStatusCategory !== "paid" &&
    /\b(already\s+)?paid\b/i.test(text)
  ) {
    return true;
  }

  const helperSaysPaymentNotDue =
    input.helperResult.resultCategory === "payment_status" &&
    input.helperResult.paymentStatusCategory === "not_due";
  const fallbackSaysPaymentNotDue =
    fallback.includes("payment not due") || fallback.includes("payment is not due");

  if (
    (helperSaysPaymentNotDue || fallbackSaysPaymentNotDue) &&
    !/\bnot\s+due\b/i.test(text) &&
    /\b(payment\s+)?(is\s+)?(due|paid|charged|payable)\b/i.test(text)
  ) {
    return true;
  }

  if (fallback.includes("canceled") && /\b(scheduled|confirmed)\b/i.test(text)) {
    return true;
  }

  if (fallback.includes("scheduled") && /\bcanceled\b/i.test(text)) {
    return true;
  }

  return false;
}

function missingPaymentOverviewLimitation(input: {
  text: string;
  helperResult: SupportAccountHelperDTO;
}) {
  if (input.helperResult.resultCategory !== "payment_overview") return false;
  const text = input.text.toLowerCase();

  return !(
    text.includes("recent") ||
    text.includes("limited") ||
    text.includes("not a full") ||
    text.includes("bounded") ||
    text.includes("récente") ||
    text.includes("récent") ||
    text.includes("limité") ||
    text.includes("vollständig") ||
    text.includes("reciente") ||
    text.includes("recente") ||
    text.includes("recenti") ||
    text.includes("ostatn") ||
    text.includes("recente") ||
    text.includes("не повн") ||
    text.includes("обмеж")
  );
}

function wrongLocale(input: { text: string; locale: AppLang }) {
  if (input.locale === "en") return false;
  return hasAny(input.text, ENGLISH_BOILERPLATE_PATTERNS);
}

export function validateAccountRewriteDraft(input: {
  draft: string;
  locale: AppLang;
  fallbackAnswer: string;
  helperResult: SupportAccountHelperDTO;
}): { ok: true } | { ok: false; reason: SupportAccountRewriteRejectedReason } {
  const text = input.draft.trim();
  if (!text) return { ok: false, reason: "empty_output" };

  if (wrongLocale({ text, locale: input.locale })) {
    return { ok: false, reason: "wrong_locale" };
  }

  if (hasAny(text, SYSTEM_CLAIM_PATTERNS)) {
    return { ok: false, reason: "unsafe_system_claim" };
  }

  if (hasAny(text, MUTATION_CLAIM_PATTERNS)) {
    return { ok: false, reason: "mutation_claim" };
  }

  if (hasAny(text, UNSUPPORTED_FACT_PATTERNS)) {
    return { ok: false, reason: "unsupported_fact" };
  }

  if (
    contradictsFallback({
      text,
      fallbackAnswer: input.fallbackAnswer,
      helperResult: input.helperResult,
    })
  ) {
    return { ok: false, reason: "contradicts_fallback" };
  }

  if (
    missingPaymentOverviewLimitation({
      text,
      helperResult: input.helperResult,
    })
  ) {
    return { ok: false, reason: "missing_required_limitation" };
  }

  return { ok: true };
}
