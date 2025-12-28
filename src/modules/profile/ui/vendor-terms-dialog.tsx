"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TermsV1 } from "@/modules/legal/terms-of-use/terms-v1";

type VendorTermsDialogProps = {
  open: boolean;
  onOpenChangeAction: (v: boolean) => void;
  onAcceptedAction: () => void; // open vendor form
};

export function VendorTermsDialog({
  open,
  onOpenChangeAction,
  onAcceptedAction,
}: VendorTermsDialogProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  // Keep this only for invalidation (no need to re-check acceptance here)
  const profileQuery = trpc.auth.getUserProfile.queryOptions();

  const acceptPolicy = useMutation({
    ...trpc.legal.acceptPolicy.mutationOptions(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
      toast.success("Terms accepted.");
      onOpenChangeAction(false);
      onAcceptedAction();
    },
    onError: () => {
      toast.error("Could not record acceptance. Please try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Terms of Use</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 max-h-[60vh]">
          <TermsV1 hideConsent />
        </div>

        {/* Centered + Accept first + consistent styling */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-8 pt-2">
          <Button
            className="w-full sm:w-auto sm:min-w-32 bg-black text-white hover:bg-pink-400 hover:text-primary"
            onClick={() => acceptPolicy.mutate()}
            disabled={acceptPolicy.isPending}
          >
            Accept
          </Button>

          <Button
            className="w-full sm:w-auto sm:min-w-32"
            variant="outline"
            onClick={() => onOpenChangeAction(false)}
            disabled={acceptPolicy.isPending}
          >
            Decline
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
