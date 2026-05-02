"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type SupportChatAiIconProps = {
  className?: string;
  iconClassName?: string;
  sparkleClassName?: string;
  variant?: "solid" | "soft" | "plain";
};

export function SupportChatAiIcon({
  className,
  iconClassName,
  sparkleClassName,
  variant = "plain",
}: SupportChatAiIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        variant === "solid" && "bg-blue-600 text-white",
        variant === "soft" && "bg-blue-50 text-blue-600",
        variant === "plain" && "text-current",
        className,
      )}
    >
      <MessageCircle className={cn("h-4 w-4", iconClassName)} />
      <Sparkles
        className={cn(
          "absolute -right-0.5 -top-0.5 h-2.5 w-2.5",
          variant === "solid" ? "text-white" : "text-blue-600",
          sparkleClassName,
        )}
      />
    </span>
  );
}
