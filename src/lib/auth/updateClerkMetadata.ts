import { clerkClient } from "@clerk/clerk-sdk-node";

/**
 * Updates Clerk public metadata with the Payload userId and username.
 * @param clerkUserId The Clerk user ID
 * @param payloadUserId The Payload (Mongo) user ID
 * @param username Optional username to update in Clerk
 */
export async function updateClerkUserMetadata(
  clerkUserId: string,
  payloadUserId: string,
  username?: string
) {
  try {
    // Update metadata
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { userId: payloadUserId },
    });
    console.log("Injected Payload User ID into Clerk metadata:", payloadUserId);

    // Update username if provided
    if (username) {
      await clerkClient.users.updateUser(clerkUserId, {
        username: username,
      });
      console.log("Updated Clerk username:", username);
    }
  } catch (err) {
    console.error("Failed to update Clerk user metadata:", err);
  }
}
