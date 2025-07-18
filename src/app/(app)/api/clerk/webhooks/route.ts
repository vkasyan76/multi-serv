import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function POST(req: Request) {
  const signingSecret = process.env.SIGNING_SECRET;
  if (!signingSecret) {
    // Controlled error, clean 500
    console.error("SIGNING_SECRET missing from env");
    return new Response("Server configuration error", { status: 500 });
  }

  const webhook = new Webhook(signingSecret);
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const requestPayload = await req.json();
  const requestBody = JSON.stringify(requestPayload);

  let webhookEvent: WebhookEvent;
  try {
    webhookEvent = webhook.verify(requestBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    console.error("Webhook verification error:", error);
    return new Response("Verification error", { status: 400 });
  }

  const { type, data } = webhookEvent;
  const clerkUserId: string = data.id || "";

  const payload = await getPayload({ config: configPromise });
  const findUser = await payload.find({
    collection: "users",
    where: { clerkUserId: { equals: clerkUserId } },
    limit: 1,
  });

  // Only update or flag/delete existing users
  if (
    (type === "user.created" || type === "user.updated") &&
    findUser.docs.length > 0
  ) {
    // Update email/username if changed
    const email = data.email_addresses?.[0]?.email_address || "";
    const username = data.username || email.split("@")[0];
    await payload.update({
      collection: "users",
      id: findUser.docs[0].id,
      data: { email, username },
    });
  }

  if (type === "user.deleted" && findUser.docs.length > 0) {
    const userDoc = findUser.docs[0];
    const tenantsArray = userDoc.tenants || [];

    // Delete each tenant referenced by this user
    // t.tenant is likely an ObjectId or string: If you use MongoDB, ObjectId fields need .toString()
    // Delete the user itself:// HARD DELETE

    try {
      // Delete each tenant referenced by this user: extract the real ID as a string
      for (const t of tenantsArray) {
        const tenantId =
          typeof t === "string"
            ? t
            : typeof t.tenant === "string"
              ? t.tenant
              : t.tenant?.id?.toString?.();
        if (tenantId) {
          await payload.delete({ collection: "tenants", id: tenantId });
        }
      }
      // Delete the user itself: HARD DELETE
      await payload.delete({ collection: "users", id: userDoc.id });
    } catch (error) {
      console.error("Failed to delete user and associated tenants:", error);
      return new Response("Failed to process deletion", { status: 500 });
    }
  }

  return new Response("Webhook received", { status: 200 });
}
