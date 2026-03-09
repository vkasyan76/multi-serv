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
import { useTranslations } from "next-intl";

type TermsAcceptanceDialogProps = {
  open: boolean;
  onOpenChangeAction: (v: boolean) => void;
  onAcceptedAction: () => void;
};

export function TermsAcceptanceDialog({
  open,
  onOpenChangeAction,
  onAcceptedAction,
}: TermsAcceptanceDialogProps) {
  const tCheckout = useTranslations("checkout");
  const trpc = useTRPC();
  const qc = useQueryClient();

  const profileQuery = trpc.auth.getUserProfile.queryOptions();

  const acceptPolicy = useMutation({
    ...trpc.legal.acceptPolicy.mutationOptions(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
      toast.success(tCheckout("terms.accepted"));
      onAcceptedAction();
      onOpenChangeAction(false);
    },
    onError: () => {
      toast.error(tCheckout("terms.accept_failed"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{tCheckout("terms.title")}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 max-h-[60vh]">
          <TermsV1 hideConsent />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-8 pt-2">
          <Button
            className="w-full sm:w-auto sm:min-w-32 bg-black text-white hover:bg-pink-400 hover:text-primary"
            onClick={() => acceptPolicy.mutate()}
            disabled={acceptPolicy.isPending}
          >
            {tCheckout("terms.accept")}
          </Button>

          <Button
            className="w-full sm:w-auto sm:min-w-32"
            variant="outline"
            onClick={() => onOpenChangeAction(false)}
            disabled={acceptPolicy.isPending}
          >
            {tCheckout("terms.decline")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}