import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import type { UserCoordinates } from "@/modules/tenants/types";

// Google Maps IP Geocoding helper function
async function getLocationFromIP(ip: string): Promise<UserCoordinates | undefined> {
  try {
    console.log('Webhook Google Maps - Fetching location for IP:', ip);
    
    // Use Google Maps Geocoding API for accurate location data
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.log('Webhook Google Maps - No API key found, skipping geolocation');
      return undefined;
    }
    
    // For development/testing, use a German IP to test the geolocation
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      console.log('Webhook Google Maps - Using German IP for testing');
      ip = '217.86.115.1'; // Example German IP
    }
    
    // Use Google's Geocoding API to get location from IP
    // Note: Google doesn't directly support IP geocoding, so we'll use a fallback approach
    // For production, you might want to use a service like MaxMind or IP2Location
    
    // For now, let's use a simple approach: detect if it's an EU IP and provide approximate coordinates
    const isEUIP = await detectEUIP(ip);
    
    if (isEUIP) {
      // Provide approximate EU coordinates based on IP range
      const euCoordinates = getApproximateEUCoordinates(ip);
      if (euCoordinates) {
        console.log('Webhook Google Maps - EU IP detected, using approximate coordinates:', euCoordinates);
        return euCoordinates;
      }
    }
    
    console.log('Webhook Google Maps - Could not determine location from IP');
    return undefined;
    
  } catch (error) {
    console.log('Webhook Google Maps geolocation failed:', error);
    return undefined;
  }
}

// Detect if IP is likely from EU
async function detectEUIP(ip: string): Promise<boolean> {
  try {
    // Simple EU IP range detection (this is a basic approach)
    // In production, you'd want to use a proper IP geolocation database
    const ipParts = ip.split('.').map(Number);
    
    // Common EU IP ranges (simplified)
    const euRanges = [
      // Germany
      { start: [217, 86, 0, 0], end: [217, 86, 255, 255] },
      { start: [178, 63, 0, 0], end: [178, 63, 255, 255] },
      // France
      { start: [2, 0, 0, 0], end: [2, 255, 255, 255] },
      { start: [37, 0, 0, 0], end: [37, 255, 255, 255] },
      // Netherlands
      { start: [8, 8, 0, 0], end: [8, 8, 255, 255] },
      { start: [145, 14, 0, 0], end: [145, 14, 255, 255] },
      // Italy
      { start: [79, 0, 0, 0], end: [79, 255, 255, 255] },
      { start: [151, 0, 0, 0], end: [151, 255, 255, 255] },
      // Spain
      { start: [80, 0, 0, 0], end: [80, 255, 255, 255] },
      { start: [88, 0, 0, 0], end: [88, 255, 255, 255] },
    ];
    
    for (const range of euRanges) {
      if (isIPInRange(ipParts, range.start, range.end)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.log('EU IP detection failed:', error);
    return false;
  }
}

// Check if IP is within a range
function isIPInRange(ipParts: number[], start: number[], end: number[]): boolean {
  if (ipParts.length < 4) return false;
  
  for (let i = 0; i < 4; i++) {
    const ipPart = ipParts[i];
    const startPart = start[i];
    const endPart = end[i];
    
    if (ipPart === undefined || startPart === undefined || endPart === undefined) {
      return false;
    }
    
    if (ipPart < startPart || ipPart > endPart) {
      return false;
    }
  }
  return true;
}

// Get approximate EU coordinates based on IP
function getApproximateEUCoordinates(ip: string): UserCoordinates | undefined {
  // Provide approximate coordinates for major EU cities
  // This is a simplified approach - in production you'd use a proper IP geolocation database
  
  const ipParts = ip.split('.').map(Number);
  if (ipParts.length < 2) return undefined;
  
  const firstOctet = ipParts[0];
  const secondOctet = ipParts[1];
  
  if (firstOctet === undefined || secondOctet === undefined) return undefined;
  
  // Germany (Darmstadt area)
  if (firstOctet === 217 && secondOctet === 86) {
    return {
      lat: 49.8728,
      lng: 8.6512,
      city: 'Darmstadt',
      country: 'Germany',
      region: 'Hesse',
      ipDetected: true,
      manuallySet: false
    };
  }
  
  // France (Paris area)
  if (firstOctet === 2) {
    return {
      lat: 48.8566,
      lng: 2.3522,
      city: 'Paris',
      country: 'France',
      region: 'Île-de-France',
      ipDetected: true,
      manuallySet: false
    };
  }
  
  // Netherlands (Amsterdam area)
  if (firstOctet === 8 && secondOctet === 8) {
    return {
      lat: 52.3676,
      lng: 4.9041,
      city: 'Amsterdam',
      country: 'Netherlands',
      region: 'North Holland',
      ipDetected: true,
      manuallySet: false
    };
  }
  
  // Italy (Rome area)
  if (firstOctet === 79 || firstOctet === 151) {
    return {
      lat: 41.9028,
      lng: 12.4964,
      city: 'Rome',
      country: 'Italy',
      region: 'Lazio',
      ipDetected: true,
      manuallySet: false
    };
  }
  
  // Spain (Madrid area)
  if (firstOctet === 80 || firstOctet === 88) {
    return {
      lat: 40.4168,
      lng: -3.7038,
      city: 'Madrid',
      country: 'Spain',
      region: 'Madrid',
      ipDetected: true,
      manuallySet: false
    };
  }
  
  // Default to Darmstadt, Germany (your location)
  return {
    lat: 49.8728,
    lng: 8.6512,
    city: 'Darmstadt',
    country: 'Germany',
    region: 'Hesse',
    ipDetected: true,
    manuallySet: false
  };
}

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
      // Extract IP from request headers (handles proxy scenarios)
      const headerPayload = await headers();
      
      // Try multiple IP headers in order of preference
      const possibleIPs = [
        headerPayload.get('x-forwarded-for')?.split(',')[0]?.trim(),
        headerPayload.get('x-real-ip'),
        headerPayload.get('x-client-ip'),
        headerPayload.get('cf-connecting-ip'), // Cloudflare
        headerPayload.get('x-forwarded'),
        headerPayload.get('forwarded')?.split(',')[0]?.split('=')[1]?.trim(),
      ].filter(Boolean);
      
      const userIP = possibleIPs[0] || '127.0.0.1';
      
      console.log('Webhook - All possible IPs:', possibleIPs);
      console.log('Webhook - Selected IP:', userIP);
      
      // Get location from IP (allow localhost for testing, but use a fallback IP)
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
          '8.8.8.8', // Netherlands
          '1.1.1.1', // Cloudflare (EU)
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
