import { auth, currentUser } from "@clerk/nextjs/server";
import {
  AuthStrategy,
  AuthStrategyFunctionArgs,
  AuthStrategyResult,
  Payload,
  User as PayloadUser,
} from "payload";

export async function getUser({
  payload,
}: {
  payload: Payload;
}): Promise<PayloadUser | null> {
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId || !clerkUser || !clerkUser.primaryEmailAddress?.emailAddress) {
    return null;
  }

  const email = clerkUser.primaryEmailAddress.emailAddress;
  const username =
    clerkUser.username || email.substring(0, email.indexOf("@")) || userId;

  const findUserQuery = await payload.find({
    collection: "users",
    where: {
      clerkUserId: { equals: userId },
    },
  });

  let payloadUser;

  if (findUserQuery.docs.length === 0) {
    payloadUser = await payload.create({
      collection: "users",
      data: {
        clerkUserId: userId,
        email,
        username,
        roles: ["user"],
      },
    });
  } else {
    payloadUser = findUserQuery.docs[0];
  }

  return {
    collection: "users",
    ...payloadUser,
    email: payloadUser.email ?? undefined, // Corrected here
  };
}

async function authenticate({
  payload,
}: AuthStrategyFunctionArgs): Promise<AuthStrategyResult> {
  const user = await getUser({ payload });

  if (!user) {
    return { user: null };
  }

  return { user };
}

export const ClerkAuthStrategy: AuthStrategy = {
  name: "clerk-auth-strategy",
  authenticate,
};
