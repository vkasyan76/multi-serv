// import { auth, currentUser } from "@clerk/nextjs/server";
import {
  AuthStrategy,
  AuthStrategyFunctionArgs,
  AuthStrategyResult,
  Payload,
  User as PayloadUser,
} from "payload";

// Scripts (ts-node) set this at the very top:
// process.env.PAYLOAD_DISABLE_AUTH_FOR_SCRIPTS = "true";
const IN_SCRIPT = process.env.PAYLOAD_DISABLE_AUTH_FOR_SCRIPTS === "true";

/** Lazy-load Clerk in a way that works in both ESM and CJS resolutions. */
/** Minimal types we need from Clerk (keep it local to avoid hard coupling). */
type ClerkAuth = () => Promise<{ userId: string | null }>;
type ClerkCurrentUser = () => Promise<{
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
} | null>;

type ClerkServerLike = { auth: ClerkAuth; currentUser: ClerkCurrentUser };

/** Type guard without `any`. */
function hasAuthCurrentUser(m: unknown): m is ClerkServerLike {
  const x = m as { auth?: unknown; currentUser?: unknown } | null | undefined;
  return typeof x?.auth === "function" && typeof x?.currentUser === "function";
}

/** Lazy-load Clerk so Node scripts never execute the import. */
async function loadClerkServer(): Promise<ClerkServerLike> {
  const mod = await import("@clerk/nextjs/server");
  if (hasAuthCurrentUser(mod))
    return { auth: mod.auth, currentUser: mod.currentUser };
  if (hasAuthCurrentUser((mod as { default?: unknown }).default))
    return (mod as { default: ClerkServerLike }).default;
  throw new Error("Unexpected @clerk/nextjs/server module shape");
}

export async function getUser({
  payload,
}: {
  payload: Payload;
}): Promise<PayloadUser | null> {
  // During scripts we don't touch Clerk at all.
  if (IN_SCRIPT) return null;

  const { auth, currentUser } = await loadClerkServer();

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

  if (!payloadUser) {
    return null;
  }

  return {
    collection: "users",
    ...payloadUser,
    email: payloadUser.email ?? "",
    username: payloadUser.username ?? "",
    clerkUserId: payloadUser.clerkUserId ?? "",
  } as PayloadUser;
}

async function authenticate({
  payload,
}: AuthStrategyFunctionArgs): Promise<AuthStrategyResult> {
  if (IN_SCRIPT) return { user: null }; // no auth in scripts
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
