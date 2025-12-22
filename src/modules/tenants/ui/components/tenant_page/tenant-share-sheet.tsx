"use client";

import { useMemo, useState } from "react";
import {
  Share2,
  Link as LinkIcon,
  Facebook as FacebookMark,
  Linkedin as LinkedInMark,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateTenantUrl } from "@/lib/utils";

// In case teh icons will stop working:

// function FacebookMark({ className }: { className?: string }) {
//   return (
//     <svg viewBox="-1 -1 26 26" className={className} aria-hidden="true">
//       <path
//         fill="currentColor"
//         d="M13.5 22v-8h2.7l.4-3H13.5V9.1c0-.9.3-1.6 1.7-1.6H16.6V4.8c-.7-.1-1.5-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3V11H7.3v3h2.6v8h3.6Z"
//       />
//     </svg>
//   );
// }

// function LinkedInMark({ className }: { className?: string }) {
//   return (
//     <svg viewBox="-1 -1 26 26" className={className} aria-hidden="true">
//       <path
//         fill="currentColor"
//         d="M6.94 6.5A2.06 2.06 0 1 1 6.94 2.4a2.06 2.06 0 0 1 0 4.1ZM4.9 21.6h4.1V8.2H4.9v13.4ZM13 8.2h3.9v1.8h.1c.5-1 1.9-2.1 3.9-2.1 4.2 0 5 2.8 5 6.4v7.3h-4.1v-6.5c0-1.6 0-3.6-2.2-3.6s-2.5 1.7-2.5 3.5v6.6H13V8.2Z"
//       />
//     </svg>
//   );
// }

type TenantShareSheetProps = {
  slug: string;
  tenantName?: string;
  showTooltip?: boolean; // ✅ large screens only (from navbar)
};

function buildAbsoluteUrl(maybeRelative: string) {
  if (maybeRelative.startsWith("http")) return maybeRelative;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!base) return maybeRelative;

  const cleanBase = base.replace(/\/$/, "");
  const cleanPath = maybeRelative.startsWith("/")
    ? maybeRelative
    : `/${maybeRelative}`;

  return `${cleanBase}${cleanPath}`;
}

export function TenantShareSheet({
  slug,
  tenantName,
  showTooltip,
}: TenantShareSheetProps) {
  const [open, setOpen] = useState(false);

  const shareUrl = useMemo(() => {
    const candidate = generateTenantUrl(slug);
    return buildAbsoluteUrl(candidate);
  }, [slug]);

  const fbShareUrl = useMemo(
    () =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareUrl
      )}`,
    [shareUrl]
  );

  const liShareUrl = useMemo(
    () =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        shareUrl
      )}`,
    [shareUrl]
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied.");
    } catch {
      // Fallback (rare)
      window.prompt("Copy this link:", shareUrl);
      toast.message("Copy the link from the prompt.");
    }
  };

  const openPopup = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const TriggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full cursor-pointer"
      onClick={() => setOpen(true)}
      aria-label={tenantName ? `Share ${tenantName}` : "Share"}
      title="Share"
    >
      <Share2 className="h-5 w-5" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Trigger */}
      {showTooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{TriggerButton}</TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        TriggerButton
      )}

      {/* Centered modal + dim backdrop is handled by Dialog */}
      <DialogContent className="w-[92vw] max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>

        {/* Icons only (no URL text, no “Share link” text) */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-8">
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-white border shadow-sm">
              <LinkIcon className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium">Copy link</span>
          </button>

          <button
            type="button"
            onClick={() => openPopup(fbShareUrl)}
            className="flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-muted/60 transition-colors cursor-pointer"
            aria-label="Share on Facebook"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#1877F2] shadow-sm">
              <FacebookMark className="h-6 w-6 text-white" />
            </span>
            <span className="text-sm font-medium">Facebook</span>
          </button>

          <button
            type="button"
            onClick={() => openPopup(liShareUrl)}
            className="flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-muted/60 transition-colors cursor-pointer"
            aria-label="Share on LinkedIn"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#0A66C2] shadow-sm">
              <LinkedInMark className="h-6 w-6 text-white -translate-x-[0.5px]" />
            </span>
            <span className="text-sm font-medium">LinkedIn</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
