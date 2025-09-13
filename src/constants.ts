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
export const BOOKING_CH = "booking-updates" as const;

export const BRIDGE_COOKIE = "inf_br" as const;

// Bridge cookie options with dev environment gating
export const BRIDGE_COOKIE_OPTS =
  process.env.NODE_ENV === "production"
    ? ({
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
        domain: `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`,
        path: "/",
      })
    : ({
        httpOnly: true,
        secure: false,
        sameSite: "lax" as const,
        // no domain on localhost
        path: "/",
      });
