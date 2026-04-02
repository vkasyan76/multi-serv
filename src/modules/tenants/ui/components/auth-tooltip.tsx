"use client";

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AuthTooltipProps {
  children: ReactElement;
  isSignedIn: boolean;
  message?: string;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  delayDuration?: number;
}

export const AuthTooltip = ({
  children,
  isSignedIn,
  message,
  side = "top",
  sideOffset = 5,
  delayDuration = 300,
}: AuthTooltipProps) => {
  const tMarketplace = useTranslations("marketplace");
  // Step 10 only localizes the default anonymous tooltip text; custom message
  // overrides and auth gating stay unchanged.
  const resolvedMessage = message ?? tMarketplace("auth.distance_tooltip");

  // If user is signed in, just render children without tooltip
  if (isSignedIn) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={sideOffset}>
          <p>{resolvedMessage}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
