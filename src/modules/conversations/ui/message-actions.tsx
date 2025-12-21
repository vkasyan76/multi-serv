"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";

type MessageActionsProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onEditAction: () => void;
  onDeleteAction: () => void;
};

export function MessageActions({
  open,
  onOpenChangeAction,
  onEditAction,
  onDeleteAction,
}: MessageActionsProps) {
  return (
    <TooltipProvider>
      <DropdownMenu open={open} onOpenChange={onOpenChangeAction}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Actions"
                onClick={(e) => e.stopPropagation()}
                className={[
                  // OUTSIDE bubble, vertically centered relative to the bubble itself
                  "absolute top-1/2 -translate-y-1/2 -left-10",

                  // Messenger-like: no white circle
                  "inline-flex h-8 w-8 items-center justify-center rounded-full",
                  "bg-transparent border-0 shadow-none",

                  // Ensure icon is visible even inside `text-primary-foreground` bubble
                  "text-muted-foreground hover:text-foreground",

                  // Subtle hover hit-area (still no “white circle” by default)
                  "hover:bg-background/60 focus:bg-background/60",

                  // Desktop: only on hover. Mobile: always visible.
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  "focus:opacity-100",

                  "transition-opacity",
                ].join(" ")}
              >
                <EllipsisVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Actions</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onSelect={onEditAction}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDeleteAction}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
