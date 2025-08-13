import { headers } from "next/headers";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { getPayload } from "payload";
import config from "@/payload.config";

// Ensure Node runtime (Svix verification needs it)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Username normalization helpers (ChatGPT's approach)
function normalizeUsername(input?: string | null, email?: string | null, fallbackId?: string) {
  // pick a base: provided username → email local-part → clerk id → "user"
  const base = (input ?? email?.split("@")[0] ?? fallbackId ?? "user").toLowerCase();

  // allow only a–z 0–9 . _ -  and trim separators
  const cleaned = base.replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "");
  if (cleaned.length < 3) return null;         // respect your min length
  return cleaned.slice(0, 32);                  // optional max length
}

async function ensureUniqueUsername(cms: Awaited<ReturnType<typeof getPayload>>, username: string) {
  let u = username, i = 0;
  while (true) {
    const found = await cms.find({
      collection: "users",
      where: { username: { equals: u } },
      limit: 1,
    });
    if (found.docs.length === 0) return u;
    i += 1;
    const suffix = String(i);
    u = (username + suffix).slice(0, 32);
  }
}

export async function POST(req: Request) {
  console.log('Webhook - POST request received');
  
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.log('Webhook - Missing svix headers');
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const webhookPayload = await req.text();

  // Create a new Svix instance with your secret.
  const wh = new Webhook(process.env.SIGNING_SECRET || "");

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(webhookPayload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.log('Webhook - Error verifying webhook:', err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  console.log('Webhook - Received event:', { type: eventType, clerkUserId: id });

  if (eventType === "user.created") {
    const { id, email_addresses, username } = evt.data;
    
    // Check if user already exists (idempotent)
    const payloadInstance = await getPayload({ config });
    const findUser = await payloadInstance.find({
      collection: "users",
      where: { clerkUserId: { equals: id } },
      limit: 1,
    });

    if (findUser.docs.length === 0) {
      console.log('Webhook - Creating new user (no coordinates)');
      const email = email_addresses?.[0]?.email_address ?? null;
      
      // build a safe username that always passes schema (ChatGPT's approach)
      let desired = normalizeUsername(username, email, id);
      if (!desired) desired = `user${id.slice(-4)}`;
      const unique = await ensureUniqueUsername(payloadInstance, desired);
      
      console.log('Webhook - Username resolved:', { original: username, resolved: unique });
      
      // Create user WITHOUT coordinates - let request-time geolocation handle that
      const newUser = await payloadInstance.create({
        collection: "users",
        data: { 
          email, 
          username: unique,           // APP-OWNED (never changes)
          clerkUsername: username,    // mirror only (for reference)
          usernameSource: "app",
          usernameSyncedAt: new Date().toISOString(),
          clerkUserId: id, 
          roles: ["user"] 
        },
      });
      console.log('Webhook - Created new user:', newUser.id);
      return new Response("New user created", { status: 200 });
    } else {
      console.log('Webhook - User already exists, skipping creation');
      return new Response("User already exists", { status: 200 });
    }
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, username } = evt.data;
    
    const payloadInstance = await getPayload({ config });
    const findUser = await payloadInstance.find({
      collection: "users",
      where: { clerkUserId: { equals: id } },
      limit: 1,
    });

    if (findUser.docs.length > 0) {
      const existingUser = findUser.docs[0];
      if (existingUser) {
        const email = email_addresses?.[0]?.email_address ?? null;
        
        // Only mirror safe fields; DO NOT change username
        const data: { email: string | null; clerkUsername: string | null } = {
          email,
          clerkUsername: username ?? null,
        };
        
        // write only when something actually changed
        if (data.email !== existingUser.email || data.clerkUsername !== existingUser.clerkUsername) {
          try {
            await payloadInstance.update({
              collection: "users",
              id: existingUser.id,
              data,
            });
            console.log('Webhook - Updated existing user:', existingUser.id);
          } catch (e) {
            // don't let a username validation error crash the webhook
            console.warn("Webhook (user.updated) skipped minor update:", e);
          }
        }
      }
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    
    const payloadInstance = await getPayload({ config });
    const findUser = await payloadInstance.find({
      collection: "users",
      where: { clerkUserId: { equals: id } },
      limit: 1,
    });

    if (findUser.docs.length > 0) {
      const existingUser = findUser.docs[0];
      if (existingUser) {
        await payloadInstance.delete({
          collection: "users",
          id: existingUser.id,
        });
        console.log('Webhook - Deleted user:', existingUser.id);
      }
    }
  }

  return new Response("Webhook received", { status: 200 });
}

export async function GET() {
  console.log('Webhook - GET request received (test endpoint)');
  return new Response("Webhook endpoint is accessible", { status: 200 });
}
