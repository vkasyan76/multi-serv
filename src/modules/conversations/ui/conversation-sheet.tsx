"use client";

import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { ConversationThread } from "@/modules/conversations/ui/conversation-thread";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UpsertForTenantOutput = RouterOutputs["conversations"]["upsertForTenant"];

type ConversationSheetProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  tenantSlug: string;
  tenantName: string;
  tenantAvatarUrl?: string | null;
  myAvatarUrl?: string | null;
  disabled?: boolean;
};

export function ConversationSheet({
  open,
  onOpenChangeAction,
  tenantSlug,
  tenantName,
  tenantAvatarUrl,
  disabled,
}: ConversationSheetProps) {
  const trpc = useTRPC();

  const [conversationId, setConversationId] = useState<string | null>(null);

  // prevent double upsert while open
  const startedRef = useRef(false);

  const upsert = useMutation({
    ...trpc.conversations.upsertForTenant.mutationOptions(),
    onSuccess: (doc: UpsertForTenantOutput) => {
      setConversationId(doc.id);
    },
  });

  // Reset when tenant changes
  useEffect(() => {
    setConversationId(null);
    startedRef.current = false;
  }, [tenantSlug]);

  // Upsert when sheet opens
  useEffect(() => {
    if (!open) return;
    if (disabled) return;
    if (startedRef.current) return;

    startedRef.current = true;
    upsert.mutate({ tenantSlug });
  }, [open, disabled, tenantSlug, upsert]);

  useEffect(() => {
    if (!open) startedRef.current = false;
  }, [open]);

  const conversationReady = !!conversationId && !upsert.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChangeAction}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={tenantAvatarUrl ?? undefined} />
              <AvatarFallback>
                {tenantName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <SheetTitle className="text-base truncate">
                {tenantName}
              </SheetTitle>
              <p className="text-xs text-muted-foreground truncate">
                {disabled
                  ? "Sign in to contact this provider."
                  : upsert.isPending
                    ? "Starting conversation…"
                    : conversationId
                      ? "Conversation ready"
                      : " "}
              </p>
            </div>

            {upsert.isPending && (
              <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </SheetHeader>

        <ConversationThread
          conversationId={conversationReady ? conversationId : null}
          viewerRole="customer"
          otherName={tenantSlug}
          otherAvatarUrl={tenantAvatarUrl ?? null}
          disabled={disabled || !conversationReady}
          emptyStateText={
            <>
              No messages yet. Start a conversation with{" "}
              <span className="font-medium">{tenantSlug}</span>.
            </>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
