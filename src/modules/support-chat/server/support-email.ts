import "server-only";

import type { Payload } from "payload";
import type { AppLang } from "@/lib/i18n/app-lang";
import type { SendEmailArgs } from "@/modules/email/types";
import { verifySelectedOrderContextToken } from "@/modules/support-chat/server/account-aware/action-tokens";

type SupportEmailUser = {
  id?: string;
  email?: string | null;
};

export type SupportEmailSender = (
  args: SendEmailArgs,
) => Promise<{ status: "sent"; providerMessageId?: string } | { status: "skipped"; reason: string }>;

export type SendSupportEmailHandoffInput = {
  db: Payload;
  clerkUserId: string;
  message: string;
  locale: AppLang;
  threadId?: string;
  currentUrl?: string;
  selectedOrderContext?: {
    type: "selected_order";
    token: string;
  };
  sendEmailImpl?: SupportEmailSender;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function supportInbox() {
  return normalizeEmail(process.env.SUPPORT_EMAIL_TO);
}

async function resolveSupportUserEmail(input: {
  db: Payload;
  clerkUserId: string;
}) {
  const result = await input.db.find({
    collection: "users",
    where: { clerkUserId: { equals: input.clerkUserId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const user = result.docs?.[0] as SupportEmailUser | undefined;
  const email = normalizeEmail(user?.email);
  if (!user?.id || !email) return null;
  return { payloadUserId: user.id, email };
}

function selectedOrderMetadata(input: {
  selectedOrderContext?: SendSupportEmailHandoffInput["selectedOrderContext"];
  threadId?: string;
}) {
  if (!input.selectedOrderContext || !input.threadId) return null;

  const verified = verifySelectedOrderContextToken({
    token: input.selectedOrderContext.token,
    threadId: input.threadId,
  });

  if (!verified.ok) return { verified: false as const };

  return {
    verified: true as const,
    referenceType: verified.input.referenceType,
    reference: verified.input.reference,
    label: verified.displayLabel,
  };
}

function buildSupportEmailBody(input: {
  userEmail: string;
  clerkUserId: string;
  payloadUserId: string;
  message: string;
  locale: AppLang;
  threadId?: string;
  currentUrl?: string;
  selectedOrder: ReturnType<typeof selectedOrderMetadata>;
}) {
  const lines = [
    "New support request from Infinisimo",
    "",
    "User:",
    `- Email: ${input.userEmail}`,
    `- Clerk user ID: ${input.clerkUserId}`,
    `- Payload user ID: ${input.payloadUserId}`,
    `- Locale: ${input.locale}`,
    input.threadId ? `- Thread ID: ${input.threadId}` : null,
    input.currentUrl ? `- Current URL: ${input.currentUrl}` : null,
    "",
    "Message:",
    input.message,
  ].filter((line): line is string => line !== null);

  if (input.selectedOrder?.verified) {
    lines.push(
      "",
      "Selected order:",
      `- Reference type: ${input.selectedOrder.referenceType}`,
      `- Reference: ${input.selectedOrder.reference}`,
    );
    if (input.selectedOrder.label) {
      lines.push(`- Label: ${input.selectedOrder.label}`);
    }
  } else if (input.selectedOrder && !input.selectedOrder.verified) {
    lines.push("", "Selected order: not verified");
  }

  const text = lines.join("\n");
  const html = `<div>${text
    .split("\n")
    .map((line) => (line ? escapeHtml(line) : "&nbsp;"))
    .join("<br />")}</div>`;

  return { text, html };
}

async function defaultSendEmail(args: SendEmailArgs) {
  const { sendEmail } = await import("@/modules/email/send");
  return sendEmail(args);
}

export async function sendSupportEmailHandoff(
  input: SendSupportEmailHandoffInput,
) {
  const to = supportInbox();
  if (!to) {
    return { ok: false as const, reason: "missing_support_inbox" as const };
  }

  const user = await resolveSupportUserEmail({
    db: input.db,
    clerkUserId: input.clerkUserId,
  });

  if (!user) {
    return { ok: false as const, reason: "missing_user_email" as const };
  }

  const selectedOrder = selectedOrderMetadata({
    selectedOrderContext: input.selectedOrderContext,
    threadId: input.threadId,
  });

  const body = buildSupportEmailBody({
    userEmail: user.email,
    clerkUserId: input.clerkUserId,
    payloadUserId: user.payloadUserId,
    message: input.message,
    locale: input.locale,
    threadId: input.threadId,
    currentUrl: input.currentUrl,
    selectedOrder,
  });

  const sendEmailImpl = input.sendEmailImpl ?? defaultSendEmail;
  const result = await sendEmailImpl({
    to,
    replyTo: user.email,
    subject: "Support request from Infinisimo user",
    text: body.text,
    html: body.html,
    headers: {
      "X-Infinisimo-Email-Type": "support-chat-handoff",
      "X-Infinisimo-User-Id": input.clerkUserId,
    },
  });

  return { ok: true as const, result };
}
