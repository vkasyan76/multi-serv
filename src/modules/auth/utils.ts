import { TRPCError } from "@trpc/server";
import { cookies as getCookies } from "next/headers";
import type { Payload } from "payload";
interface Props {
  prefix: string;
  value: string;
}

export const generateAuthCookie = async ({ prefix, value }: Props) => {
  const cookies = await getCookies();
  cookies.set({
    name: `${prefix}-token`,
    value: value,
    httpOnly: true,
    path: "/",
    // ensure cross-domain coookie sharing -- see cookies fix in Chapter 31: only in production
    // This enables cookie auth on local host but it will not work on subdomains turned on
    ...(process.env.NODE_ENV !== "development" && {
      sameSite: "none",
      domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
      secure: true,
    }),
  });
};

// used in tenant stripe onboarding

// accept only the methods we need, keeps it structurally compatible
type PayloadLike = Pick<Payload, "find" | "findByID">;

export async function resolveUserTenant(db: PayloadLike, userId: string) {
  const user = await db.find({
    collection: "users",
    where: { clerkUserId: { equals: userId } },
    limit: 1,
  });

  if (user.totalDocs === 0)
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

  const currentUser = user.docs[0];
  if (!currentUser?.tenants?.length)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No tenant found for user",
    });

  const tenantRef = currentUser.tenants[0]?.tenant;
  const tenantId = typeof tenantRef === "object" ? tenantRef.id : tenantRef;

  if (!tenantId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No tenant found for user",
    });
  }

  const tenant = await db.findByID({
    collection: "tenants",
    id: tenantId as string,
  });

  if (!tenant) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tenant not found",
    });
  }

  const stripeAccountId =
    typeof tenant.stripeAccountId === "string"
      ? tenant.stripeAccountId.trim()
      : "";

  if (!stripeAccountId)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe account id is missing on tenant",
    });

  return {
    user: currentUser,
    tenant,
    tenantId: tenantId as string,
    stripeAccountId,
  };
}
