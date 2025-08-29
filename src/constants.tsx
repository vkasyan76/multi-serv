export const DEFAULT_LIMIT = 2;

export const SERVICES_OPTIONS = [
  { label: "On-site", value: "on-site" },
  { label: "On-line", value: "on-line" },
] as const;

export const SORT_VALUES = [
  "price_low_to_high",
  "price_high_to_low",
  "distance",
  "tenure_newest",
  "tenure_oldest",
] as const;

export const MAX_SLOTS_PER_BOOKING = 8;
export const TOAST_MS_SUCCESS = 3000;
export const TOAST_MS_WARNING = 5000;
export const FAIL_HIGHLIGHT_MS = 2000;
export const BOOKING_CH = 'booking-updates' as const;
