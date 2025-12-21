"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { TenantInbox } from "@/modules/conversations/ui/tenant-inbox";
import { TenantConversationPanel } from "@/modules/conversations/ui/tenant-conversation-panel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

  const [mobileView, setMobileView] = useState<"inbox" | "thread">("inbox");

  // ✅ detect mobile (Tailwind md breakpoint is 768px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");

    const sync = () => setIsMobile(mql.matches);
    sync();

    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  // ✅ if user becomes desktop (resize/rotate), close the sheet view
  useEffect(() => {
    if (!isMobile) setMobileView("inbox");
  }, [isMobile]);

  useEffect(() => {
    // reset when tenant changes
    setActive(null);
    setMobileView("inbox");
  }, [tenantSlug]);

  const handleSelect = (c: InboxItem) => {
    setActive(c);

    // ✅ only open the Sheet on mobile
    if (isMobile) setMobileView("thread");
  };

  const handleBack = () => {
    // ✅ back is only meaningful on mobile sheet UX
    if (isMobile) setMobileView("inbox");
  };

  // Tenant dashboard mobile UX: show either Inbox OR Conversation (full screen) + Back button

  return (
    <div className="h-[70vh] rounded-lg border bg-white overflow-hidden">
      <div className="h-full min-h-0 md:grid md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Inbox: hidden on mobile when viewing thread; always visible on md+ */}
        <div className="h-full min-h-0">
          <TenantInbox
            tenantSlug={tenantSlug}
            activeConversationId={conversationId}
            onSelectAction={handleSelect}
          />
        </div>

        {/* Thread: hidden on mobile until selected; always visible on md+ */}
        <div className="hidden md:block h-full min-h-0">
          <TenantConversationPanel
            conversationId={conversationId}
            customerName={customerName}
            customerAvatarUrl={customerAvatarUrl}
            tenantName={tenantName}
            tenantAvatarUrl={tenantAvatarUrl}
            disabled={false}
            onBackAction={handleBack} // ✅ back button appears only on mobile
          />
        </div>
      </div>
      {/* ✅ Mobile full-screen thread */}
      <div className="md:hidden">
        {" "}
        <Sheet
          open={isMobile && mobileView === "thread" && !!conversationId}
          onOpenChange={(open) => {
            if (!isMobile) return;
            setMobileView(open ? "thread" : "inbox");
          }}
        >
          <SheetContent
            side="right"
            className={[
              "w-full p-0 flex flex-col",
              "h-dvh", // ✅ reliable full mobile height
              "[&>button]:hidden", // ✅ hide Sheet default close button (use chevron)
            ].join(" ")}
          >
            {/* ✅ Required for Radix a11y: DialogTitle must exist */}
            <SheetHeader className="sr-only">
              <SheetTitle>{`Conversation with ${customerName}`}</SheetTitle>
            </SheetHeader>
            <TenantConversationPanel
              conversationId={conversationId}
              customerName={customerName}
              customerAvatarUrl={customerAvatarUrl}
              tenantName={tenantName}
              tenantAvatarUrl={tenantAvatarUrl}
              disabled={false}
              onBackAction={handleBack} // ✅ chevron back on mobile
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
