"use client";

import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Globe } from "lucide-react";
import { AuthTooltip } from "@/modules/tenants/ui/components/auth-tooltip";
import {
  DEFAULT_DISTANCE_OPTION,
  DISTANCE_OPTIONS,
  distanceIndexToOption,
  distanceOptionToIndex,
  normalizeDistanceOption,
} from "@/modules/tenants/distance-options";

interface Props {
  maxDistance?: number | null;
  isEnabled?: boolean;
  onMaxDistanceChangeAction: (value: number | null) => void;
  onToggleChangeAction: (enabled: boolean) => void;
  hasOnlineServices?: boolean;
  isSignedIn: boolean;
}

export function DistanceFilter({
  maxDistance,
  isEnabled = false,
  onMaxDistanceChangeAction,
  onToggleChangeAction,
  hasOnlineServices = false,
  isSignedIn,
}: Props) {
  const tMarketplace = useTranslations("marketplace");

  // Drive the slider by preset indices so mobile/category can reach 300 km
  // without a huge, overly sensitive raw-kilometer slider.
  const [previewIndex, setPreviewIndex] = useState<number[]>([
    distanceOptionToIndex(maxDistance),
  ]);

  const enabled = !!isEnabled;
  const current =
    normalizeDistanceOption(maxDistance) ?? DEFAULT_DISTANCE_OPTION;
  const previewDistance = distanceIndexToOption(previewIndex[0] ?? 0);

  // Update preview when maxDistance changes
  useEffect(() => {
    setPreviewIndex([distanceOptionToIndex(maxDistance)]);
  }, [maxDistance]);

  const getSmartSuggestion = () => {
    if (hasOnlineServices && enabled) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
          <Globe className="h-3 w-3" />
          <span>{tMarketplace("distance.online_hint")}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Toggle Switch */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium text-base">
            {tMarketplace("distance.search_nearby")}
          </Label>
        </div>
        <AuthTooltip isSignedIn={!!isSignedIn}>
          <div>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => onToggleChangeAction(checked)}
              disabled={!isSignedIn}
              className={!isSignedIn ? "opacity-50 cursor-not-allowed" : ""}
            />
          </div>
        </AuthTooltip>
      </div>

      {/* Smart Suggestion */}
      {getSmartSuggestion()}

      {/* Slider only when enabled */}
      {enabled && (
        <div className="space-y-3 pl-6 border-l-2 border-muted">
          <div className="flex items-center justify-between">
            {/* Step 3 stays display-only; slider/auth behavior remains unchanged. */}
            <span className="text-sm text-muted-foreground">
              {tMarketplace("distance.max_distance")}
            </span>
            {/* Show the mapped preset live while dragging so the label never
            leaks internal slider indices or stale legacy values. */}
            <span className="text-sm font-medium">
              {(enabled ? previewDistance : current)} km
            </span>
          </div>

          <Slider
            min={0}
            max={DISTANCE_OPTIONS.length - 1}
            step={1}
            value={previewIndex}
            onValueChange={(val) => setPreviewIndex(val)}
            // Commit the shared preset value to parent state/URL on release.
            onValueCommit={([val]) =>
              onMaxDistanceChangeAction(distanceIndexToOption(val ?? 0))
            }
            className="w-full"
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{DISTANCE_OPTIONS[0]} km</span>
            <span>{DISTANCE_OPTIONS[DISTANCE_OPTIONS.length - 1]} km</span>
          </div>
        </div>
      )}
    </div>
  );
}
