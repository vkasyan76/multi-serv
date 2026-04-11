// Shared distance presets for homepage and marketplace filters.
// Keep one canonical scale so desktop, mobile, and category pages cannot drift.
export const DISTANCE_OPTIONS = [
  5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300,
] as const;

export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];
export const DEFAULT_DISTANCE_OPTION: DistanceOption = 50;

export function findNearestDistanceOption(value: number): DistanceOption {
  let nearest: DistanceOption = DISTANCE_OPTIONS[0];
  let nearestDelta = Math.abs(value - nearest);

  for (const option of DISTANCE_OPTIONS) {
    const delta = Math.abs(value - option);

    // If a legacy value sits exactly between two presets, round upward so the
    // normalization rule is deterministic and matches product expectations.
    if (delta < nearestDelta || (delta === nearestDelta && option > nearest)) {
      nearest = option;
      nearestDelta = delta;
    }
  }

  return nearest;
}

export function normalizeDistanceOption(
  value?: number | null
): DistanceOption | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return findNearestDistanceOption(value);
}

export function distanceOptionToIndex(value?: number | null): number {
  const normalized = normalizeDistanceOption(value) ?? DEFAULT_DISTANCE_OPTION;
  const index = DISTANCE_OPTIONS.indexOf(normalized);
  return index >= 0 ? index : DISTANCE_OPTIONS.indexOf(DEFAULT_DISTANCE_OPTION);
}

export function distanceIndexToOption(index: number): DistanceOption {
  const safeIndex = Math.min(
    DISTANCE_OPTIONS.length - 1,
    Math.max(0, Math.round(index))
  );

  return DISTANCE_OPTIONS[safeIndex]!;
}
