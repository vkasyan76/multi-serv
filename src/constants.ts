export const DEFAULT_LIMIT = 20;

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
    ? {
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
        domain: `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`,
        path: "/",
      }
    : {
        httpOnly: true,
        secure: false,
        sameSite: "lax" as const,
        // no domain on localhost
        path: "/",
      };

//  Payment Policy Constants
export const AUTO_CONFIRM_DAYS_DEFAULT = 5;
export const SERVICE_ACTION_DEADLINE_DAYS = 5; //(confirm or dispute)
export const PAYMENT_DEADLINE_DAYS = 5; // (pay or dispute after confirmation)
export const CANCELLATION_WINDOW_HOURS = 24;
export const COMMISSION_RATE_BPS_DEFAULT = 500;
// Dispute Policy
export const DISPUTE_WINDOW_DAYS_DEFAULT = 14; // allow disputes up to N days after service completion date

// --- Booking statuses (central enums) ---
export const BOOKING_SERVICE_STATUSES = [
  "scheduled",
  "completed",
  "confirmed",
  "disputed",
] as const;
export type BookingServiceStatus = (typeof BOOKING_SERVICE_STATUSES)[number];

export const BOOKING_PAYMENT_STATUSES = ["unpaid", "pending", "paid"] as const;
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number];

// --- Dispute statuses (central enums) ---
export const DISPUTE_STATUSES = ["open", "resolved", "withdrawn"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

// --- Policy versioning ---
export const POLICY_VERSION = "v1";
