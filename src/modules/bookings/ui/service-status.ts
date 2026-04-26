"use client";

import type { Booking } from "@/payload-types";

export type NormalizedServiceStatus =
  | "requested"
  | "scheduled"
  | "completed"
  | "accepted"
  | "disputed";

export type BookingLegendKey =
  | "available"
  | "requested"
  | "scheduled"
  | "completed"
  | "accepted"
  | "disputed";

//color for available slots without any service status yet
export const AVAILABLE_STATUS_META = {
  key: "available",
  className: "bg-emerald-300",
  hex: "#86efac",
} as const;

export const SERVICE_STATUS_ORDER: NormalizedServiceStatus[] = [
  "requested",
  "scheduled",
  "completed",
  "accepted",
  "disputed",
];

export const SERVICE_STATUS_KEYS: Record<
  NormalizedServiceStatus,
  Exclude<BookingLegendKey, "available">
> = {
  requested: "requested",
  scheduled: "scheduled",
  completed: "completed",
  accepted: "accepted",
  disputed: "disputed",
};

// Keep legacy labels for order tables until that wave migrates to translated UI keys.
export const SERVICE_STATUS_LABELS: Record<NormalizedServiceStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  accepted: "Accepted",
  disputed: "Disputed",
};

export const SERVICE_STATUS_COLORS: Record<
  NormalizedServiceStatus,
  { className: string; hex: string }
> = {
  requested: { className: "bg-orange-300", hex: "#fdba74" },
  scheduled: { className: "bg-amber-400", hex: "#fbbf24" },
  completed: { className: "bg-sky-400", hex: "#38bdf8" },
  accepted: { className: "bg-teal-600", hex: "#0d9488" },
  disputed: { className: "bg-rose-400", hex: "#fb7185" },
};

export function normalizeServiceStatus(
  ss: Booking["serviceStatus"] | null | undefined,
): NormalizedServiceStatus {
  if (ss === "requested") return ss;
  if (ss === "completed" || ss === "accepted" || ss === "disputed") return ss;
  return "scheduled";
}

export function getServiceStatusLabel(
  ss: Booking["serviceStatus"] | null | undefined,
): string {
  return SERVICE_STATUS_LABELS[normalizeServiceStatus(ss)];
}

export function getServiceStatusKey(
  ss: Booking["serviceStatus"] | null | undefined,
): Exclude<BookingLegendKey, "available"> {
  return SERVICE_STATUS_KEYS[normalizeServiceStatus(ss)];
}

export function getServiceStatusColorHex(
  ss: Booking["serviceStatus"] | null | undefined,
): string {
  return SERVICE_STATUS_COLORS[normalizeServiceStatus(ss)].hex;
}
