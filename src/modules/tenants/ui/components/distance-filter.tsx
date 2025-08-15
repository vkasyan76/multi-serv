"use client";

import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { MapPin, Globe } from "lucide-react";
import { AuthTooltip } from "@/modules/tenants/ui/components/auth-tooltip";

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

  // local preview only (does not own truth):
  const [preview, setPreview] = useState<number[]>([maxDistance ?? 50]);

  const enabled = !!isEnabled;
  const current =
    maxDistance !== null && maxDistance !== undefined && maxDistance > 0
      ? maxDistance
      : 50;

  // Update preview when maxDistance changes
  useEffect(() => {
    if (maxDistance !== null && maxDistance !== undefined && maxDistance > 0) {
      setPreview([maxDistance]);
    }
  }, [maxDistance]);

  const getSmartSuggestion = () => {
    if (hasOnlineServices && enabled) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
          <Globe className="h-3 w-3" />
          <span>
            Online services work from anywhere. Consider disabling distance
            filter.
          </span>
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
          <Label className="font-medium text-base">Search Nearby</Label>
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
            <span className="text-sm text-muted-foreground">Max distance</span>
            <span className="text-sm font-medium">{current} km</span>
          </div>

          <Slider
            min={5}
            max={100}
            step={5}
            // Keep UI smooth while dragging:
            value={preview}
            onValueChange={(val) => setPreview(val)}
            // Commit to parent (URL) only on release:
            onValueCommit={([val]) =>
              onMaxDistanceChangeAction(val && val > 0 ? val : null)
            }
            className="w-full"
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5 km</span>
            <span>100 km</span>
          </div>
        </div>
      )}
    </div>
  );
}
