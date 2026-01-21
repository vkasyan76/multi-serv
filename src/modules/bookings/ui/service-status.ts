"use client";

import type { Booking } from "@/payload-types";

export type NormalizedServiceStatus =
  | "scheduled"
  | "completed"
  | "accepted"
  | "disputed";

//color for available slots without any service status yet
export const AVAILABLE_STATUS_META = {
  label: "Available",
  className: "bg-emerald-300",
  hex: "#86efac",
} as const;

export const SERVICE_STATUS_ORDER: NormalizedServiceStatus[] = [
  "scheduled",
  "completed",
  "accepted",
  "disputed",
];

export const SERVICE_STATUS_LABELS: Record<NormalizedServiceStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  accepted: "Accepted",
  disputed: "Disputed",
};

export const SERVICE_STATUS_COLORS: Record<
  NormalizedServiceStatus,
  { className: string; hex: string }
> = {
  scheduled: { className: "bg-amber-400", hex: "#fbbf24" },
  completed: { className: "bg-sky-400", hex: "#38bdf8" },
  accepted: { className: "bg-teal-600", hex: "#0d9488" },
  disputed: { className: "bg-rose-400", hex: "#fb7185" },
};

export function normalizeServiceStatus(
  ss: Booking["serviceStatus"] | null | undefined,
): NormalizedServiceStatus {
  if (ss === "completed" || ss === "accepted" || ss === "disputed") return ss;
  return "scheduled";
}

export function getServiceStatusLabel(
  ss: Booking["serviceStatus"] | null | undefined,
): string {
  return SERVICE_STATUS_LABELS[normalizeServiceStatus(ss)];
}

export function getServiceStatusColorHex(
  ss: Booking["serviceStatus"] | null | undefined,
): string {
  return SERVICE_STATUS_COLORS[normalizeServiceStatus(ss)].hex;
}
