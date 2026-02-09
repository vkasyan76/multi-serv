import { headers } from "next/headers";
import { Webhook } from "svix";
import { getPayload } from "payload";
import config from "@/payload.config";

// Ensure Node runtime (Svix verification needs it)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendWebhookEvent = {
  type?: string;
  data?: {
    email?: string | null;
    to?: string[] | string | null;
    bounce?: {
      type?: string | null; // "Permanent" | "Transient" | "Undetermined"
    } | null;
  } | null;
};

const normalizeEmail = (value?: string | null) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

function extractRecipients(data: ResendWebhookEvent["data"]) {
  const recipients = new Set<string>();

  const one = normalizeEmail(data?.email);
  if (one) recipients.add(one);

  const to = data?.to;
  const list = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
  for (const raw of list) {
    const email = normalizeEmail(raw);
    if (email) recipients.add(email);
  }

  return [...recipients];
}

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[resend-webhook] missing RESEND_WEBHOOK_SECRET");
    return new Response("Webhook secret is not configured", { status: 500 });
  }

  const webhookPayload = await req.text();
  const wh = new Webhook(secret);

  let evt: ResendWebhookEvent;
  try {
    evt = wh.verify(webhookPayload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ResendWebhookEvent;
  } catch (err) {
    console.warn("[resend-webhook] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType = String(evt?.type ?? "");
  const data = evt?.data ?? {};
  const recipients = extractRecipients(data);

  if (recipients.length === 0) {
    return new Response("No recipient email", { status: 200 });
  }

  const payload = await getPayload({ config });

  const updateUsersByEmail = async (
    email: string,
    patch: Record<string, unknown>,
  ) => {
    const found = await payload.find({
      collection: "users",
      where: { email: { equals: email } },
      limit: 20,
      overrideAccess: true,
      depth: 0,
    });

    for (const doc of found.docs) {
      try {
        await payload.update({
          collection: "users",
          id: doc.id,
          data: patch,
          overrideAccess: true,
          depth: 0,
        });
      } catch (err) {
        console.error(
          `[resend-webhook] failed to update user ${doc.id} (${email})`,
          err,
        );
      }
    }
  };

  // Suppress on complaint. For bounces, only suppress permanent failures.
  if (eventType === "email.complained") {
    const patch = {
      emailDeliverabilityStatus: "hard_suppressed",
      emailDeliverabilityReason: "complaint",
      emailDeliverabilityRetryAfter: null,
      emailDeliverabilityUpdatedAt: new Date().toISOString(),
    };
    for (const email of recipients) {
      await updateUsersByEmail(email, patch);
    }
  }

  if (eventType === "email.bounced") {
    const bounceType = String(data?.bounce?.type ?? "").toLowerCase();
    const isPermanent = bounceType === "permanent";

    if (isPermanent) {
      const patch = {
        emailDeliverabilityStatus: "hard_suppressed",
        emailDeliverabilityReason: "bounce_permanent",
        emailDeliverabilityRetryAfter: null,
        emailDeliverabilityUpdatedAt: new Date().toISOString(),
      };
      for (const email of recipients) {
        await updateUsersByEmail(email, patch);
      }
    }
  }

  return new Response("ok", { status: 200 });
}
