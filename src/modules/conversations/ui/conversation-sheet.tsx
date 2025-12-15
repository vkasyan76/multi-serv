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
import { toast } from "sonner";

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
  authState?: boolean | null; // check if user is signed in via payload backend
  viewerKey?: string | null; // NEW: resets sheet when auth user changes
  onBridgeResync?: () => Promise<boolean>; //  one-shot “bridge handshake then retry” hook
};

export function ConversationSheet({
  open,
  onOpenChangeAction,
  tenantSlug,
  tenantName,
  tenantAvatarUrl,
  myAvatarUrl,
  disabled,
  authState = null,
  viewerKey = null,
  onBridgeResync,
}: ConversationSheetProps) {
  const trpc = useTRPC();

  const [conversationId, setConversationId] = useState<string | null>(null);

  // prevent double upsert while open
  const startedRef = useRef(false);

  const didHardReloadRef = useRef(false); // to reload the page if the users is expected to be authed but the sheet does not open

  const upsert = useMutation({
    ...trpc.conversations.upsertForTenant.mutationOptions(),
    onSuccess: (doc: UpsertForTenantOutput) => {
      setConversationId(doc.id);
    },
    onError: async (err) => {
      const code = (err as { data?: { code?: string } })?.data?.code;

      if (code === "UNAUTHORIZED") {
        // Only attempt resync/reload if we EXPECT a signed-in user.
        if (
          authState === true &&
          viewerKey &&
          onBridgeResync &&
          !didHardReloadRef.current
        ) {
          didHardReloadRef.current = true;

          const ok = await onBridgeResync();
          // reload the window if the user is signed in but the sheet did not open
          if (ok) {
            // remember user intent across hard reload (same-tab only)
            sessionStorage.setItem(
              "pendingConversationOpen",
              JSON.stringify({ tenantSlug, ts: Date.now() })
            );

            window.location.reload();
            return;
          }
        }

        toast.error("Sign in to contact this provider.");
        onOpenChangeAction(false);
        return;
      }

      toast.error("Couldn't start the conversation. Please try again.");
    },
  });

  // Reset when tenant changes: reset on tenant OR viewer change: don’t keep a previous user’s conversationId / mutation state when the auth user changes.
  const { reset } = upsert;

  useEffect(() => {
    setConversationId(null);
    startedRef.current = false;
    didHardReloadRef.current = false; // allow recovery again on auth/user change
    reset();
  }, [tenantSlug, viewerKey, reset]);

  // Upsert when sheet opens
  // Do not render ConversationThread until you have a conversationId (and are authed).
  const canStart = authState === true && !disabled;

  // Upsert when sheet opens (only when authed)
  useEffect(() => {
    if (!open) return;
    if (!canStart) return;
    if (startedRef.current) return;

    startedRef.current = true;
    upsert.mutate({ tenantSlug });
  }, [open, canStart, tenantSlug, upsert]);

  useEffect(() => {
    if (!open) startedRef.current = false;
  }, [open]);

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
                {authState === null
                  ? "Checking sign-in…"
                  : authState === false
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

        <div className="flex-1 min-h-0">
          {authState === false ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              Sign in to contact this provider.
            </div>
          ) : authState === null ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              Checking sign-in…
            </div>
          ) : upsert.isError ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              Sign in to contact this provider.
            </div>
          ) : upsert.isPending || !conversationId ? (
            <div className="h-full grid place-items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading conversation…
            </div>
          ) : (
            <ConversationThread
              conversationId={conversationId}
              viewerRole="customer"
              otherName={tenantSlug}
              otherAvatarUrl={tenantAvatarUrl ?? null}
              myAvatarUrl={myAvatarUrl ?? null}
              disabled={!!disabled}
              emptyStateText={
                <>
                  No messages yet. Start a conversation with{" "}
                  <span className="font-medium">{tenantSlug}</span>.
                </>
              }
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
