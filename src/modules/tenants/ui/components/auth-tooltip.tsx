"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AuthTooltipProps {
  children: React.ReactNode;
  isSignedIn: boolean;
  message?: string;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  delayDuration?: number;
}

export const AuthTooltip = ({
  children,
  isSignedIn,
  message = "Log in to determine your location for distance features.",
  side = "top",
  sideOffset = 5,
  delayDuration = 300,
}: AuthTooltipProps) => {
  // If user is signed in, just render children without tooltip
  if (isSignedIn) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={sideOffset}>
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
