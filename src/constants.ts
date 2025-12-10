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

// normalize ONLY for production cookie domain
function normalizeCookieDomain(raw?: string) {
  if (!raw) return undefined;

  // strip protocol + path
  const hostWithPath = raw.replace(/^https?:\/\//, "").split("/")[0];
  if (!hostWithPath) return undefined;

  // strip port
  const hostNoPort = hostWithPath.split(":")[0];
  if (!hostNoPort) return undefined;

  // strip leading dot + www.
  const host = hostNoPort.replace(/^\./, "").replace(/^www\./, "");
  // don't set Domain on localhost-style hosts
  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]"
  ) {
    return undefined;
  }

  return `.${host}`;
}

const PROD_COOKIE_DOMAIN =
  process.env.NODE_ENV === "production"
    ? normalizeCookieDomain(process.env.NEXT_PUBLIC_ROOT_DOMAIN)
    : undefined;

// Bridge cookie options with dev environment gating
export const BRIDGE_COOKIE_OPTS =
  process.env.NODE_ENV === "production"
    ? {
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
        domain: PROD_COOKIE_DOMAIN, // ✅ safe`,
        path: "/",
      }
    : {
        httpOnly: true,
        secure: false,
        sameSite: "lax" as const,
        // no domain on localhost
        path: "/",
      };
