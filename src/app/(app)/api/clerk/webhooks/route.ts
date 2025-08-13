import { headers } from "next/headers";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { getPayload } from "payload";
import config from "@/payload.config";

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
  const payload = await req.text();

  // Create a new Svix instance with your secret.
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
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
    const payload = await getPayload({ config });
    const findUser = await payload.find({
      collection: "users",
      where: { clerkUserId: { equals: id } },
      limit: 1,
    });

    if (findUser.docs.length === 0) {
      console.log('Webhook - Creating new user (no coordinates)');
      const email = email_addresses?.[0]?.email_address || "";
      const usernameValue = username || email.split("@")[0] || "";
      
      // Create user WITHOUT coordinates - let request-time geolocation handle that
      const newUser = await payload.create({
        collection: "users",
        data: { 
          email, 
          username: usernameValue, 
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
    
    const payload = await getPayload({ config });
    const findUser = await payload.find({
      collection: "users",
      where: { clerkUserId: { equals: id } },
      limit: 1,
    });

    if (findUser.docs.length > 0) {
      const existingUser = findUser.docs[0];
      if (existingUser) {
        const email = email_addresses?.[0]?.email_address || "";
        const usernameValue = username || email.split("@")[0] || "";
        
        // Update existing user (idempotent)
        await payload.update({
          collection: "users",
          id: existingUser.id,
          data: { 
            email, 
            username: usernameValue 
          },
        });
        console.log('Webhook - Updated existing user:', existingUser.id);
      }
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    
    const payload = await getPayload({ config });
    const findUser = await payload.find({
      collection: "users",
      where: { clerkUserId: { equals: id } },
      limit: 1,
    });

    if (findUser.docs.length > 0) {
      const existingUser = findUser.docs[0];
      if (existingUser) {
        await payload.delete({
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
