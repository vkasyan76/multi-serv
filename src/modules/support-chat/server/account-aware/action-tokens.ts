import "server-only";

import crypto from "node:crypto";
import type { SupportAccountHelperInput } from "./types";
import { SUPPORT_ACCOUNT_HELPER_VERSION } from "./versioning";

const TOKEN_VERSION = "support-account-action-v1";
const TOKEN_TTL_MS = 10 * 60 * 1000;
const SELECTED_ORDER_CONTEXT_VERSION = "support-account-selected-order-v1";
const SELECTED_ORDER_CONTEXT_TTL_MS = 30 * 60 * 1000;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export type AccountCandidateSelectionHelper =
  | "getOrderStatusForCurrentUser"
  | "getPaymentStatusForCurrentUser"
  | "canCancelOrderForCurrentUser";

export type AccountCandidateActionTokenPayload = {
  type: "account_candidate_select";
  version: typeof TOKEN_VERSION;
  helper: AccountCandidateSelectionHelper;
  referenceType: "order_id";
  reference: string;
  threadId: string;
  helperVersion: string;
  displayLabel?: string;
  displayDescription?: string;
  expiresAt: string;
};

export type SelectedOrderContextTokenPayload = {
  type: "selected_order_context";
  version: typeof SELECTED_ORDER_CONTEXT_VERSION;
  referenceType: "order_id";
  reference: string;
  threadId: string;
  helperVersion: string;
  displayLabel?: string;
  displayDescription?: string;
  selectedAt: string;
  expiresAt: string;
};

function signingSecret() {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) {
    throw new Error("PAYLOAD_SECRET is required for support-chat action tokens.");
  }
  return secret;
}

function encryptionKey() {
  return crypto.createHash("sha256").update(signingSecret()).digest();
}

function encryptPayload(
  payload: AccountCandidateActionTokenPayload | SelectedOrderContextTokenPayload,
) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

function decryptPayload(token: string) {
  const [ivValue, encryptedValue, tagValue] = token.split(".");
  if (!ivValue || !encryptedValue || !tagValue) return null;

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as unknown;
}

function isSelectionHelper(
  value: unknown,
): value is AccountCandidateSelectionHelper {
  return (
    value === "getOrderStatusForCurrentUser" ||
    value === "getPaymentStatusForCurrentUser" ||
    value === "canCancelOrderForCurrentUser"
  );
}

function isPayloadObjectId(value: unknown) {
  return typeof value === "string" && OBJECT_ID_RE.test(value);
}

function assertPayloadObjectId(value: string) {
  if (!isPayloadObjectId(value)) {
    throw new Error("Support-chat account action reference must be a valid order id.");
  }
}

function parsePayload(value: unknown): AccountCandidateActionTokenPayload | null {
  const payload = value as Partial<AccountCandidateActionTokenPayload> | null;
  if (!payload || payload.type !== "account_candidate_select") return null;
  if (payload.version !== TOKEN_VERSION) return null;
  if (!isSelectionHelper(payload.helper)) return null;
  if (payload.referenceType !== "order_id") return null;
  if (!isPayloadObjectId(payload.reference)) return null;
  if (typeof payload.threadId !== "string" || !payload.threadId) return null;
  if (payload.helperVersion !== SUPPORT_ACCOUNT_HELPER_VERSION) return null;
  if (typeof payload.expiresAt !== "string") return null;
  return payload as AccountCandidateActionTokenPayload;
}

function parseSelectedOrderContextPayload(
  value: unknown,
): SelectedOrderContextTokenPayload | null {
  const payload = value as Partial<SelectedOrderContextTokenPayload> | null;
  if (!payload || payload.type !== "selected_order_context") return null;
  if (payload.version !== SELECTED_ORDER_CONTEXT_VERSION) return null;
  if (payload.referenceType !== "order_id") return null;
  if (!isPayloadObjectId(payload.reference)) return null;
  if (typeof payload.threadId !== "string" || !payload.threadId) return null;
  if (payload.helperVersion !== SUPPORT_ACCOUNT_HELPER_VERSION) return null;
  if (typeof payload.selectedAt !== "string") return null;
  if (typeof payload.expiresAt !== "string") return null;
  return payload as SelectedOrderContextTokenPayload;
}

export function createAccountCandidateActionToken(input: {
  helper: AccountCandidateSelectionHelper;
  reference: string;
  threadId: string;
  displayLabel?: string;
  displayDescription?: string;
  now?: Date;
}) {
  assertPayloadObjectId(input.reference);
  const now = input.now ?? new Date();
  const payload: AccountCandidateActionTokenPayload = {
    type: "account_candidate_select",
    version: TOKEN_VERSION,
    helper: input.helper,
    referenceType: "order_id",
    reference: input.reference,
    threadId: input.threadId,
    helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
    displayLabel: input.displayLabel,
    displayDescription: input.displayDescription,
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
  };
  return encryptPayload(payload);
}

export function createSelectedOrderContextToken(input: {
  reference: string;
  threadId: string;
  displayLabel?: string;
  displayDescription?: string;
  now?: Date;
}) {
  assertPayloadObjectId(input.reference);
  const now = input.now ?? new Date();
  const payload: SelectedOrderContextTokenPayload = {
    type: "selected_order_context",
    version: SELECTED_ORDER_CONTEXT_VERSION,
    referenceType: "order_id",
    reference: input.reference,
    threadId: input.threadId,
    helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
    displayLabel: input.displayLabel,
    displayDescription: input.displayDescription,
    selectedAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + SELECTED_ORDER_CONTEXT_TTL_MS,
    ).toISOString(),
  };
  return encryptPayload(payload);
}

export function verifyAccountCandidateActionToken(input: {
  token: string;
  threadId: string;
  now?: Date;
}):
  | {
      ok: true;
      helper: AccountCandidateSelectionHelper;
      input: SupportAccountHelperInput;
      displayLabel?: string;
      displayDescription?: string;
    }
  | { ok: false; reason: "invalid_token" | "expired_token" } {
  let payload: AccountCandidateActionTokenPayload | null = null;
  try {
    payload = parsePayload(decryptPayload(input.token));
  } catch {
    return { ok: false, reason: "invalid_token" };
  }

  if (!payload || payload.threadId !== input.threadId) {
    return { ok: false, reason: "invalid_token" };
  }

  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= (input.now ?? new Date()).getTime()) {
    return { ok: false, reason: "expired_token" };
  }

  return {
    ok: true,
    helper: payload.helper,
    input: {
      referenceType: payload.referenceType,
      reference: payload.reference,
    },
    displayLabel: payload.displayLabel,
    displayDescription: payload.displayDescription,
  };
}

export function verifySelectedOrderContextToken(input: {
  token: string;
  threadId: string;
  now?: Date;
}):
  | {
      ok: true;
      input: SupportAccountHelperInput & { referenceType: "order_id" };
      displayLabel?: string;
      displayDescription?: string;
    }
  | { ok: false; reason: "invalid_token" | "expired_token" } {
  let payload: SelectedOrderContextTokenPayload | null = null;
  try {
    payload = parseSelectedOrderContextPayload(decryptPayload(input.token));
  } catch {
    return { ok: false, reason: "invalid_token" };
  }

  if (!payload || payload.threadId !== input.threadId) {
    return { ok: false, reason: "invalid_token" };
  }

  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= (input.now ?? new Date()).getTime()) {
    return { ok: false, reason: "expired_token" };
  }

  return {
    ok: true,
    input: {
      referenceType: payload.referenceType,
      reference: payload.reference,
    },
    displayLabel: payload.displayLabel,
    displayDescription: payload.displayDescription,
  };
}
