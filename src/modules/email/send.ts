import "server-only";
import { Resend } from "resend";
import type { SendEmailArgs } from "./types";

const resendApiKey = process.env.RESEND_API_KEY ?? "";
if (!resendApiKey) {
  throw new Error("RESEND_API_KEY is not configured");
}
const resend = new Resend(resendApiKey);

function parseAllowlist() {
  const raw = process.env.EMAIL_DEV_ALLOWLIST ?? "";
  return new Set(
    raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function getRetryAfterTs(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export type SendEmailResult =
  | { status: "sent"; providerMessageId?: string }
  | { status: "skipped"; reason: string };

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const to = args.to.trim().toLowerCase();
  const toEmail = to;

  // Deliverability policy:
  // - hard_suppressed: never send (explicit complaint/permanent bounce/manual block)
  // - soft_suppressed: pause sending until retryAfter (for transient bounce windows)
  const status = args.deliverability?.status ?? "ok";
  if (status === "hard_suppressed") {
    return {
      status: "skipped",
      reason: `hard_suppressed (${args.deliverability?.reason ?? "unknown"})`,
    };
  }
  if (status === "soft_suppressed") {
    const retryAfterTs = getRetryAfterTs(args.deliverability?.retryAfter);
    if (!retryAfterTs || retryAfterTs > Date.now()) {
      return {
        status: "skipped",
        reason: `soft_suppressed (${args.deliverability?.reason ?? "unknown"})`,
      };
    }
  }

  if (isDev()) {
    const allowlist = parseAllowlist();
    if (allowlist.size > 0 && !allowlist.has(toEmail)) {
      return {
        status: "skipped",
        reason: "recipient not in EMAIL_DEV_ALLOWLIST",
      };
    }
  }

  const from = process.env.EMAIL_FROM ?? "";
  if (!from) {
    return { status: "skipped", reason: "EMAIL_FROM not configured" };
  }

  const res = await resend.emails.send({
    from,
    to: toEmail,
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo: args.replyTo,
    headers: args.headers,
  });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return { status: "sent", providerMessageId: res.data?.id };
}
