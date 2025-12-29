"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BookSlotsButton } from "@/modules/checkout/ui/book-slots-button";

interface BookingActionButtonProps {
  signedState: boolean | null;
  slug: string;
  selectedIds: string[];
  pricePerHourCents: number;
  className?: string;
}

export function BookingActionButton({
  signedState,
  slug,
  selectedIds,
  pricePerHourCents,
  className = "w-full",
}: BookingActionButtonProps) {
  if (signedState === true) {
    return (
      <BookSlotsButton
        tenantSlug={slug}
        selectedIds={selectedIds}
        pricePerHourCents={pricePerHourCents}
      />
    );
  }

  if (signedState === null) {
    return (
      <Button className={className} disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Checking sign-in…
      </Button>
    );
  }

  return (
    <Button
      className={className}
      onClick={() => toast.error("Sign in to book this provider.")}
    >
      Book slots ({selectedIds.length})
    </Button>
  );
}
