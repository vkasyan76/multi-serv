"use client";

import { Button } from "@/components/ui/button";
import { ConversationThread } from "@/modules/conversations/ui/conversation-thread";
import { ChevronLeft } from "lucide-react";

type TenantConversationPanelProps = {
  conversationId: string | null;

  // the customer you're talking to
  customerName: string;
  customerAvatarUrl?: string | null;

  // tenant identity (for avatars / labels)
  tenantName: string;
  tenantAvatarUrl?: string | null;

  disabled?: boolean;

  // ✅ Mobile-only back behavior (WhatsApp-like)
  onBackAction?: () => void;
};

export function TenantConversationPanel({
  conversationId,
  customerName,
  customerAvatarUrl,
  tenantName,
  tenantAvatarUrl,
  disabled,
  onBackAction,
}: TenantConversationPanelProps) {
  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* ✅ Grey-ish header for optical separation */}
      <div className="px-4 py-3 border-b bg-muted/40 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {/* ✅ Back button only on small screens */}
          {/* Make header stick and ensure the thread area can scroll */}
          {onBackAction && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden -ml-2"
              onClick={onBackAction}
              aria-label="Back to inbox"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{customerName}</div>
          </div>
        </div>
      </div>
      {/* Ensure the thread has a proper flex height boundary */}
      <div className="flex-1 min-h-0">
        {" "}
        <ConversationThread
          conversationId={conversationId}
          viewerRole="tenant"
          otherName={customerName}
          otherAvatarUrl={customerAvatarUrl ?? null}
          myName={tenantName}
          myAvatarUrl={tenantAvatarUrl ?? null}
          disabled={disabled || !conversationId}
          emptyStateText={
            conversationId ? (
              <span>No messages yet.</span>
            ) : (
              <span>Select a conversation on the left.</span>
            )
          }
        />
      </div>
    </div>
  );
}
