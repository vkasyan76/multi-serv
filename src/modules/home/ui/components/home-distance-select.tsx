"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DISTANCE_OPTIONS,
  normalizeDistanceOption,
} from "@/modules/tenants/distance-options";
import { HOME_FILTER_PILL_CLASSNAME } from "./home-filter-pill";
import { cn } from "@/lib/utils";

type Props = {
  isSignedIn: boolean;
  hasViewerCoords: boolean;
  distanceFilterEnabled: boolean;
  maxDistance: number | null;
  onChange: (next: { enabled: boolean; maxDistance: number | null }) => void;
  className?: string;
};

export function HomeDistanceSelect({
  isSignedIn,
  hasViewerCoords,
  distanceFilterEnabled,
  maxDistance,
  onChange,
  className,
}: Props) {
  const tMarketplace = useTranslations("marketplace");
  const normalizedDistance = normalizeDistanceOption(maxDistance);

  const value =
    distanceFilterEnabled && normalizedDistance !== null
      ? String(normalizedDistance)
      : "any";

  const handleValueChange = (nextValue: string) => {
    if (nextValue === "any") {
      onChange({ enabled: false, maxDistance: null });
      return;
    }

    onChange({ enabled: true, maxDistance: Number(nextValue) });
  };

  const canUseDistance = isSignedIn && hasViewerCoords;

  if (!canUseDistance) {
    const tooltipMessage = !isSignedIn
      ? tMarketplace("auth.distance_tooltip")
      : tMarketplace("auth.distance_location_required");

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn("w-full min-w-0", className)}
              aria-disabled="true"
            >
              {/* Keep this as a real button so keyboard users can still focus
              the gated state and read why distance isn't available yet. */}
              <span className={cn(HOME_FILTER_PILL_CLASSNAME, "opacity-60")}>
                <span className="leading-tight">
                  {tMarketplace("filters.location_distance")}
                </span>
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      <Select value={value} onValueChange={handleValueChange}>
        {/* Match the homepage pill buttons: the shared select trigger keeps its
        behavior, but the trigger chrome must use the same box model here. */}
        {/* Use the shared homepage pill shell while keeping real Select semantics. */}
        <SelectTrigger size="pill">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="any">
            {tMarketplace("distance.any_distance")}
          </SelectItem>
          {DISTANCE_OPTIONS.map((distance) => (
            <SelectItem key={distance} value={String(distance)}>
              {distance} km
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
