import { clerkClient } from "@clerk/clerk-sdk-node";

/**
 * Updates Clerk public metadata with the Payload userId.
 * @param clerkUserId The Clerk user ID
 * @param payloadUserId The Payload (Mongo) user ID
 */
export async function updateClerkUserMetadata(
  clerkUserId: string,
  payloadUserId: string
) {
  try {
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { userId: payloadUserId },
    });
    console.log("Injected Payload User ID into Clerk metadata:", payloadUserId);
  } catch (err) {
    console.error("Failed to update Clerk user metadata:", err);
  }
}
