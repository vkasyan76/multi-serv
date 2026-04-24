import "server-only";
import { notFound } from "next/navigation";

import { isSuperAdmin } from "@/lib/access";
import { caller } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await caller.auth.session();

  if (!isSuperAdmin(session?.user ?? null)) {
    notFound();
  }

  return children;
}
