import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import type { UserCoordinates } from "@/modules/tenants/types";
import { getLocationFromIP, extractIPFromHeaders } from "@/modules/profile/location-utils";

export async function POST(req: Request) {
  console.log('Webhook - POST request received');
  
  const signingSecret = process.env.SIGNING_SECRET;
  if (!signingSecret) {
    // Controlled error, clean 500
    console.error("SIGNING_SECRET missing from env");
    return new Response("Server configuration error", { status: 500 });
  }

  console.log('Webhook - Signing secret found, processing webhook');

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

  console.log('Webhook - Received event:', { type, clerkUserId });

  const payload = await getPayload({ config: configPromise });
  const findUser = await payload.find({
    collection: "users",
    where: { clerkUserId: { equals: clerkUserId } },
    limit: 1,
  });

  console.log('Webhook - User search result:', { 
    type, 
    clerkUserId, 
    existingUsers: findUser.docs.length 
  });

  // Handle new user creation with IP geolocation
  if (type === "user.created" && findUser.docs.length === 0) {
    console.log('Webhook - Creating new user with IP geolocation');
    
    const email = data.email_addresses?.[0]?.email_address || "";
    const username = data.username || email.split("@")[0] || "";
    
    // Get user's IP address for geolocation
    let coordinates: UserCoordinates | undefined = undefined;
    try {
      const headerPayload = await headers();
      console.log('Webhook - All headers received:', Object.fromEntries(headerPayload.entries()));
      
      const userIP = extractIPFromHeaders(headerPayload);
      console.log('Webhook - Selected IP:', userIP);
      console.log('Webhook - IP extraction details:', {
        'x-forwarded-for': headerPayload.get('x-forwarded-for'),
        'x-real-ip': headerPayload.get('x-real-ip'),
        'x-client-ip': headerPayload.get('x-client-ip'),
        'cf-connecting-ip': headerPayload.get('cf-connecting-ip'),
        'x-forwarded': headerPayload.get('x-forwarded'),
        'forwarded': headerPayload.get('forwarded'),
      });

      if (userIP && userIP !== '127.0.0.1' && userIP !== '::1' && userIP !== 'localhost') {
        coordinates = await getLocationFromIP(userIP);
        console.log('Webhook - IP geolocation result:', coordinates);
      } else {
        // For development/testing, use EU IPs to test the geolocation
        console.log('Webhook - Using EU IP for testing');
        // Try different EU IPs for testing
        const euIPs = [
          '217.86.115.1', // Germany
          '2.2.2.2', // France
          '145.14.1.1', // Netherlands
          '79.1.1.1', // Italy
        ];
        
        for (const testIP of euIPs) {
          coordinates = await getLocationFromIP(testIP);
          if (coordinates && coordinates.country && coordinates.country.includes('Germany')) {
            console.log('Webhook - German IP geolocation result:', coordinates);
            break;
          }
        }
        
        if (!coordinates) {
          console.log('Webhook - No EU IP geolocation result, using fallback');
        }
      }
    } catch (error) {
      console.log('Webhook - IP geolocation failed during user creation:', error);
      // Continue without coordinates - user can set them later
    }

    // Create new user with IP-detected coordinates
    const newUser = await payload.create({
      collection: "users",
      data: {
        email,
        username,
        clerkUserId,
        roles: ["user"],
        coordinates: coordinates, // Include IP-detected coordinates
        // No tenants initially - will be added when user becomes vendor
      },
    });

    console.log('Webhook - Created new user with coordinates:', newUser.id);
    return new Response("New user created with IP geolocation", { status: 200 });
  }

  // Only update or flag/delete existing users
  if (
    (type === "user.created" || type === "user.updated") &&
    findUser.docs.length > 0
  ) {
    // Update email/username if changed
    const email = data.email_addresses?.[0]?.email_address || "";
    const username = data.username || email.split("@")[0];
    const userDoc = findUser.docs[0];
    if (userDoc) {
      await payload.update({
        collection: "users",
        id: userDoc.id,
        data: { email, username },
      });
    }
  }

  if (type === "user.deleted" && findUser.docs.length > 0) {
    const userDoc = findUser.docs[0];
    if (userDoc) {
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
  }

  return new Response("Webhook received", { status: 200 });
}

// Add a GET endpoint for testing webhook accessibility
export async function GET() {
  console.log('Webhook - GET request received (test endpoint)');
  return new Response("Webhook endpoint is accessible", { status: 200 });
}
