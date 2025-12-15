"use client";

import { ConversationThread } from "@/modules/conversations/ui/conversation-thread";

type TenantConversationPanelProps = {
  conversationId: string | null;

  // the customer you're talking to
  customerName: string;
  customerAvatarUrl?: string | null;

  // tenant identity (for avatars / labels)
  tenantName: string;
  tenantAvatarUrl?: string | null;

  disabled?: boolean;
};

export function TenantConversationPanel({
  conversationId,
  customerName,
  customerAvatarUrl,
  tenantName,
  tenantAvatarUrl,
  disabled,
}: TenantConversationPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-background">
        <div className="text-sm font-semibold truncate">{customerName}</div>
        <div className="text-xs text-muted-foreground truncate">
          Conversation
        </div>
      </div>

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
  );
}
