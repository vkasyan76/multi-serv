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

// Safe suffix helper - ensures suffix isn't chopped by 32-char limit
function withSuffix(base: string, suffix: string, max = 32) {
  const room = Math.max(0, max - suffix.length);
  return `${base.slice(0, room)}${suffix}`.slice(0, max);
}

async function ensureUniqueUsername(cms: Awaited<ReturnType<typeof getPayload>>, username: string) {
  let i = 0;
  const maxAttempts = 100;
  let candidate = username;

  while (i < maxAttempts) {
    const found = await cms.find({
      collection: "users",
      where: { username: { equals: candidate } },
      limit: 1,
    });
    if (found.docs.length === 0) return candidate;
    i += 1;
    candidate = withSuffix(username, String(i)); // safe append within 32 chars
  }

  // Fallback: timestamp + tiny random
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random()*100).toString().padStart(2,"0")}`;
  return withSuffix(username, suffix);
}

// Consistent ID masking helper for PII protection
const mask = (v: unknown) => `${String(v ?? "").slice(0, 8)}…`;

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

  // Get the event type
  const eventType = evt.type;

  // Log all webhook events with masked IDs - enhanced diagnostic logging
  console.log('Webhook event:', evt.type, 'clerkId:', mask(evt.data?.id));

  if (eventType === "user.created") {
    const { id: clerkId, email_addresses, username: clerkUsername } = evt.data;
    
    console.log('Webhook - Received event:', { type: eventType, clerkUserId: mask(clerkId) });
    
    // Check if user already exists (idempotent)
    const payloadInstance = await getPayload({ config });
    const findUser = await payloadInstance.find({
      collection: "users",
      where: { clerkUserId: { equals: clerkId } },
      limit: 1,
    });

    if (findUser.docs.length === 0) {
      console.log('Webhook - Creating new user (no coordinates)');
      const primaryEmailId = evt.data.primary_email_address_id;
      const email = email_addresses?.find(e => e.id === primaryEmailId)?.email_address ?? 
                    email_addresses?.[0]?.email_address ?? null;
      
      // build a safe username that always passes schema (ChatGPT's approach)
      let desired = normalizeUsername(clerkUsername, email, clerkId);
      if (!desired) desired = `user${clerkId.slice(-4)}`;
      const unique = await ensureUniqueUsername(payloadInstance, desired);
      
      console.log('Webhook - Username resolved:', { original: clerkUsername, resolved: unique });
      
      // Create user WITHOUT coordinates - let request-time geolocation handle that
      const newUser = await payloadInstance.create({
        collection: "users",
        data: { 
          email, 
          username: unique,           // APP-OWNED (never changes)
          clerkUsername: clerkUsername,    // mirror only (for reference)
          usernameSource: "app",
          usernameSyncedAt: new Date().toISOString(),
          clerkUserId: clerkId, 
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
    const { id: clerkId, email_addresses, username } = evt.data;
    
    console.log('Webhook - Received event:', { type: eventType, clerkUserId: mask(clerkId) });
    
    const payloadInstance = await getPayload({ config });
    const findUser = await payloadInstance.find({
      collection: "users",
      where: { clerkUserId: { equals: clerkId } },
      limit: 1,
    });

    if (findUser.docs.length > 0) {
      const existingUser = findUser.docs[0];
      if (existingUser) {
        const primaryEmailId = evt.data.primary_email_address_id;
        const email = email_addresses?.find(e => e.id === primaryEmailId)?.email_address ?? 
                      email_addresses?.[0]?.email_address ?? null;
        
        // Only mirror safe fields; DO NOT change username
        // Build update data conditionally to avoid persisting null values
        const updateData: Record<string, unknown> = {};
        if (email && email !== existingUser.email) {
          updateData.email = email;
        }
        if (username !== undefined && username !== existingUser.clerkUsername) {
          updateData.clerkUsername = username ?? null;
        }
        
        // write only when something actually changed
        if (Object.keys(updateData).length > 0) {
          try {
            await payloadInstance.update({
              collection: "users",
              id: existingUser.id,
              data: updateData,
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
    try {
      const clerkId = evt.data?.id;
      if (!clerkId) {
        console.error('user.deleted missing id');
        return new Response('bad payload', { status: 400 });
      }

      console.log('user.deleted processing:', { clerkUserId: mask(clerkId) });
      
      const payloadInstance = await getPayload({ config });
      const found = await payloadInstance.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkId } },
        limit: 1,
        overrideAccess: true, // IMPORTANT in server/webhook context
      });
      console.log('Delete lookup count:', found.docs.length, 'for', mask(clerkId));

      if (found.docs.length > 0) {
        const existingUser = found.docs[0];
        if (existingUser) {
          await payloadInstance.delete({
            collection: "users",
            id: existingUser.id, // delete by Payload doc ID, not by where
            overrideAccess: true,
          });
          console.log('Deleted user doc:', existingUser.id, 'for', mask(clerkId));
        }
      } else {
        console.log('No matching user, nothing to delete for', mask(clerkId));
      }
      return new Response('ok');
    } catch (e) {
      console.error('user.deleted failed', e);
      return new Response('delete failed', { status: 500 }); // non-2xx so Clerk retries
    }
  }

  return new Response("Webhook received", { status: 200 });
}

export async function GET() {
  console.log('Webhook - GET request received (test endpoint)');
  return new Response("Webhook endpoint is accessible", { status: 200 });
}
