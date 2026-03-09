"use client";

import { useTranslations } from "next-intl";
import {
  AVAILABLE_STATUS_META,
  SERVICE_STATUS_COLORS,
  SERVICE_STATUS_KEYS,
  SERVICE_STATUS_ORDER,
} from "./service-status";

export function CalendarLegend({ className = "" }: { className?: string }) {
  const tBookings = useTranslations("bookings");

  const Square = ({ className }: { className: string }) => (
    <span className={`inline-block size-3 ${className}`} />
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${className}`}
      //legend can wrap onto multiple lines (important on smaller widths / dashboard header).
    >
      <span className="flex items-center gap-1.5">
        <Square className={AVAILABLE_STATUS_META.className} />{" "}
        {tBookings(`legend.${AVAILABLE_STATUS_META.key}`)}
      </span>
      {SERVICE_STATUS_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <Square className={SERVICE_STATUS_COLORS[status].className} />{" "}
          {tBookings(`legend.${SERVICE_STATUS_KEYS[status]}`)}
        </span>
      ))}
    </div>
  );
}
