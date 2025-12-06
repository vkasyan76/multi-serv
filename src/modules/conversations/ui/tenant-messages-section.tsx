"use client";

import { useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { TenantInbox } from "@/modules/conversations/ui/tenant-inbox";
import { TenantConversationPanel } from "@/modules/conversations/ui/tenant-conversation-panel";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type InboxItem =
  RouterOutputs["conversations"]["listForTenant"]["docs"][number];

function getImageUrl(image: unknown): string | null {
  if (!image || typeof image !== "object") return null;
  if (!("url" in image)) return null;
  const url = (image as { url?: unknown }).url;
  return typeof url === "string" ? url : null;
}

export function TenantMessagesSection({ tenantSlug }: { tenantSlug: string }) {
  const trpc = useTRPC();
  const [active, setActive] = useState<InboxItem | null>(null);

  const vendorQ = useQuery(trpc.auth.getVendorProfile.queryOptions());

  const tenantName = vendorQ.data?.name ?? tenantSlug;

  const tenantAvatarUrl = useMemo(
    () => getImageUrl(vendorQ.data?.image),
    [vendorQ.data?.image]
  );

  const conversationId = active?.id ?? null;

  const customerName = useMemo(
    () => active?.customer?.name ?? "Customer",
    [active]
  );

  // Optional: only if your listForTenant actually includes it; otherwise keep null.
  const customerAvatarUrl = useMemo(() => {
    const c = (active?.customer ?? null) as unknown;
    if (!c || typeof c !== "object") return null;
    if (!("clerkImageUrl" in c)) return null;
    const u = (c as { clerkImageUrl?: unknown }).clerkImageUrl;
    return typeof u === "string" ? u : null;
  }, [active]);

  return (
    <div className="h-[70vh] rounded-lg border bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] h-full">
        <TenantInbox
          tenantSlug={tenantSlug}
          activeConversationId={conversationId}
          onSelectAction={setActive}
        />

        <TenantConversationPanel
          conversationId={conversationId}
          customerName={customerName}
          customerAvatarUrl={customerAvatarUrl}
          tenantName={tenantName}
          tenantAvatarUrl={tenantAvatarUrl}
          disabled={false}
        />
      </div>
    </div>
  );
}
