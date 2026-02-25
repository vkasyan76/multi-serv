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
// Phase 2C referral capture cookie (separate from auth bridge cookie).
export const REFERRAL_COOKIE = "infin_ref" as const;
export const REFERRAL_COOKIE_TTL_DAYS = 15;
export const REFERRAL_COOKIE_TTL_SECONDS =
  60 * 60 * 24 * REFERRAL_COOKIE_TTL_DAYS;
// Short-lived notice for smart referral redirects (invalid/expired campaign UX).
export const REFERRAL_NOTICE_COOKIE = "ref_notice" as const;
// Keep this brief to reduce repeated banners without adding one-time clear logic.
export const REFERRAL_NOTICE_TTL_SECONDS = 60;
// Explicit rollout switch for referral capture (smart links + persistence paths).
export const REFERRAL_CAPTURE_ENABLED =
  process.env.REFERRAL_CAPTURE_ENABLED === "1";

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
// The “rule identifier” label for the non-promo default commission logic.
export const PROMO_RULE_ID_DEFAULT = "default-v1";
// Current fee basis for checkout-time platform fee snapshots.
export const PLATFORM_FEE_BASIS = "net" as const;
// Safety cap: max active promotions the resolver will load (MVP assumes low volume).
export const PROMOTIONS_RESOLVER_MAX_ACTIVE = 500;
// Dispute Policy
export const DISPUTE_WINDOW_DAYS_DEFAULT = 14; // allow disputes up to N days after service completion date

// Wallet is EUR-only for MVP; keeps summaries consistent with Stripe fees.
export const WALLET_CURRENCY = "eur" as const;
export const WALLET_PAGE_SIZE = 200;
// Shared wallet list limits so server validation and UI pagination stay in sync.
export const WALLET_TRANSACTIONS_LIMIT_DEFAULT = 50;
export const WALLET_TRANSACTIONS_LIMIT_STEP = 50;
export const WALLET_TRANSACTIONS_LIMIT_MAX = 100;

// --- Service lifecycle statuses (shared) ---
export const SERVICE_STATUSES = [
  "scheduled",
  "completed",
  "accepted",
  "disputed",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

// --- Booking payment statuses ---
export const BOOKING_PAYMENT_STATUSES = ["unpaid", "pending", "paid"] as const;
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number];

// --- Dispute statuses (central enums) ---
export const DISPUTE_STATUSES = ["open", "resolved", "withdrawn"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

// --- Terms versioning ---
export const TERMS_VERSION = "v1";

// --- Cookies ---
export const COOKIE_CONSENT_VERSION = "v1";
export const COOKIE_CONSENT_COOKIE = "infinisimo_cookie_consent";
export const OPEN_COOKIE_PREFS_EVENT = "open-cookie-preferences" as const;
export const CONSENT_UPDATED_EVENT = "cookie-consent-updated" as const;

