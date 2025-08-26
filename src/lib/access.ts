import { ClientUser, Payload } from "payload";
import type { User } from "@payload-types";
import type { Tenant } from "@/payload-types";

export const isSuperAdmin = (user: ClientUser | User | null) => {
  return Boolean(user?.roles?.includes("super-admin"));
};

export async function ownsTenant(
  payload: Payload,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const t = (await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
  })) as Tenant | null;

  if (!t) return false;
  const ownerId = typeof t.user === "string" ? t.user : t.user?.id;
  return ownerId === userId;
}
