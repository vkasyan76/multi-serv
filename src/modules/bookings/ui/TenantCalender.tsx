"use client";

import { Calendar, Views } from "react-big-calendar";
import type {
  SlotInfo,
  EventPropGetter,
  SlotPropGetter,
} from "react-big-calendar";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/trpc/routers/_app";
import "react-big-calendar/lib/css/react-big-calendar.css";

import {
  startOfDay,
  endOfDay,
  startOfHour,
  addHours,
  addDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Booking } from "@/payload-types";
import { getLocaleAndCurrency } from "@/modules/profile/location-utils";
import CalendarNav, { CalendarMode } from "@/modules/bookings/ui/CalendarNav";
import { CalendarLegend } from "./CalendarLegend";

import {
  rbcLocalizer,
  rbcFormats,
  getCultureFromProfile,
  intlFormatters,
  rolling,
} from "../utils/dates-utils";

type Props = {
  tenantSlug: string;
  height?: number | string; // default 520px - controls internal scroll viewport
  defaultStartHour?: number; // default 8 - used to build scrollToTime
};

type RbcEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Booking; // your payload Booking doc
};

// Rolling week functionality now managed in dates-utils.ts

export default function TenantCalendar({
  tenantSlug,
  height = 520,
  defaultStartHour = 8,
}: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get culture from profile utility (consistent with rest of app)
  const culture = useMemo(
    () => getCultureFromProfile(getLocaleAndCurrency),
    []
  );

  // Get Intl formatters for tooltips (consistent with RBC localization)
  const { dateFmt } = useMemo(() => intlFormatters(culture), [culture]);

  // ---- Creation rules ----
  // Keep 0 for "can create from the current time onward".
  // Later you can bump to e.g. 2*60*60*1000 (2 hours) if you want a buffer.
  const LEAD_MS = 0;

  // Auto-scroll to configurable start hour (default morning start) on mount
  const scrollTo = useMemo(() => {
    return new Date(1970, 0, 1, defaultStartHour, 0, 0);
  }, [defaultStartHour]);

  // Rolling 7-day window starting today (so the first fetch matches the view)
  const [range, setRange] = useState(() => {
    const start = startOfDay(new Date());
    const end = endOfDay(addDays(start, 6));
    return { start, end };
  });

  // Calendar navigation state
  const [mode] = useState<CalendarMode>("week");
  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));

  // Re-render every minute so past/future logic updates automatically
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  /** Future-only (with optional lead time) */
  const canCreateAt = useCallback(
    (start: Date) => {
      return start.getTime() >= nowTick + LEAD_MS;
    },
    [nowTick]
  );

  // Keep range in sync with mode and anchor changes
  useEffect(() => {
    if (mode === "week") {
      const start = startOfDay(anchor);
      const end = endOfDay(addDays(start, 6));
      setRange({ start, end });
    } else {
      const start = startOfMonth(anchor);
      const end = endOfMonth(anchor);
      setRange({ start, end });
    }
  }, [mode, anchor]);

  // Keep the localizer in sync with our UI mode and anchor
  useEffect(() => {
    rolling.useRollingWeek = mode === "week";
    rolling.anchor = startOfDay(anchor);
  }, [mode, anchor]);

  // Navigation label using the existing formatters
  const navLabel = useMemo(() => {
    if (mode === "week") {
      return `${dateFmt.format(anchor)} — ${dateFmt.format(addDays(anchor, 6))}`;
    }
    return new Intl.DateTimeFormat(culture, {
      month: "long",
      year: "numeric",
    }).format(anchor);
  }, [mode, anchor, dateFmt, culture]);

  // Load tenant (to get tenantId for creating slots)
  const tenantQ = useQuery(
    trpc.tenants.getOne.queryOptions({ slug: tenantSlug })
  );

  // Load slots for the visible range - v5 correct syntax
  const slotsQ = useQuery({
    ...trpc.bookings.listPublicSlots.queryOptions({
      tenantSlug,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    }),
    placeholderData: (prev: Booking[] | undefined) => prev,
    staleTime: 30_000,
    refetchInterval: 60_000, // Poll each minute to keep data fresh
    refetchOnWindowFocus: false,
  });

  // Debug logging to help verify ranges
  useEffect(() => {
    console.log("Calendar range - Local:", range.start, "to", range.end);
    console.log(
      "Calendar range - UTC:",
      range.start.toISOString(),
      "to",
      range.end.toISOString()
    );
    console.log("Slots returned:", slotsQ.data?.length || 0);
  }, [range, slotsQ.data]);

  // Double-click detection helpers
  const lastSlotClickRef = useRef<{ ts: number; startMs: number } | null>(null);
  const DOUBLE_MS = 300;

  // Single-click timers + last click state
  const slotSingleTimerRef = useRef<number | null>(null);
  const lastEventClickRef = useRef<{ ts: number; id: string } | null>(null);
  const eventSingleTimerRef = useRef<number | null>(null);

  // In-flight locks to prevent duplicate mutations
  const inFlightEventIds = useRef<Set<string>>(new Set()); // deletes
  const inFlightSlotKeys = useRef<Set<number>>(new Set()); // creates (by startMs)

  // Helper to detect duplicate slots
  const existingHasRange = useCallback(
    (start: Date, end: Date) => {
      const items = slotsQ.data ?? [];
      const s = start.getTime();
      const e = end.getTime();
      return items.some(
        (b) =>
          new Date(b.start).getTime() === s && new Date(b.end).getTime() === e
      );
    },
    [slotsQ.data]
  );

  // Query invalidation helper
  const invalidateSlots = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.bookings.listPublicSlots.queryKey({
        tenantSlug,
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      }),
    });
  }, [
    queryClient,
    tenantSlug,
    range.start,
    range.end,
    trpc.bookings.listPublicSlots,
  ]);

  // Slot creation mutation with proper query invalidation and error handling
  const createSlot = useMutation({
    ...trpc.bookings.createAvailableSlot.mutationOptions(),
    onSuccess: invalidateSlots,
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      if (err.data?.code === "CONFLICT") return; // legit double click
      console.error("Failed to create slot:", err);
    },
  });

  // Slot removal mutation
  const removeSlot = useMutation({
    ...trpc.bookings.removeSlot.mutationOptions(),
    onSuccess: invalidateSlots,
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      console.error("Failed to remove slot:", err);
    },
  });

  const isMutating = createSlot.isPending || removeSlot.isPending;

  // Map bookings -> RBC events with UI cleanup for past available slots
  const events: RbcEvent[] = useMemo(() => {
    const nowMs = nowTick; // Use the ticking "now"
    return (slotsQ.data ?? [])
      .filter((b) => {
        if (b.status === "confirmed") return true; // keep all confirmed (past + future)
        // Hide available slots once their start time has arrived
        const startMs = new Date(b.start).getTime();
        return startMs > nowMs;
      })
      .map(
        (b: Booking): RbcEvent => ({
          id: b.id,
          title: b.status === "available" ? "" : "Booked", // Empty title for available events
          start: new Date(b.start),
          end: new Date(b.end),
          resource: b,
        })
      );
  }, [slotsQ.data, nowTick]);

  // Color-code events and tag by status for CSS styling
  const eventPropGetter: EventPropGetter<RbcEvent> = useCallback((event) => {
    const isAvailable = event.resource.status === "available";
    return {
      className: isAvailable ? "ev-available" : "ev-booked",
      style: {
        backgroundColor: isAvailable ? "#86efac" : "#fbbf24", // emerald-300 vs amber-400 (friendlier)
        border: "none",
        color: "#111827",
      },
    };
  }, []);

  // Visually mute past hours and disable 23:00 slots
  const slotPropGetter: SlotPropGetter = useCallback(
    (date) => {
      const h = date.getHours();
      const isPast = date.getTime() < nowTick;

      // Disable 23:00 starts - would cross midnight for 1-hour slots
      if (h === 23) {
        return {
          style: {
            opacity: 0.45,
            pointerEvents: "none",
            cursor: "not-allowed",
            backgroundImage:
              "repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 6px, #e5e7eb 6px, #e5e7eb 12px)",
          },
          title:
            "Last 1-hour slot starts at 22:00. 23:00 would cross midnight.",
        };
      }

      if (isPast) {
        return {
          className: "rbc-slot-past",
          style: { backgroundColor: "#f3f4f6" }, // Tailwind gray-100 for clear distinction
        };
      }

      return {};
    },
    [nowTick]
  );

  // Localized tooltip - concise format without time duplication
  const tooltipAccessor = useCallback(
    (e: RbcEvent) => {
      if (e.resource.status === "available") {
        // Just show day and status (time already shown by RBC)
        return `Available - ${dateFmt.format(e.start)}`;
      } else {
        // For booked events, show booking info
        return `Booked - ${dateFmt.format(e.start)}`;
      }
    },
    [dateFmt]
  );

  // Handle slot selection - single-then-double logic
  const onSelectSlot = useCallback(
    async (slotInfo: SlotInfo) => {
      const tenantId = tenantQ.data?.id;
      if (!tenantId || isMutating) return;

      const start = startOfHour(new Date(slotInfo.start));

      // Block 23:00 starts - a 1-hour slot would cross midnight
      if (start.getHours() === 23) return;

      const end = addHours(start, 1);
      const now = Date.now();
      const startMs = +start;

      // Check in-flight lock for this slot
      if (inFlightSlotKeys.current.has(startMs)) return;
      inFlightSlotKeys.current.add(startMs);

      try {
        // second click within window → cancel single + create immediately
        const last = lastSlotClickRef.current;
        if (last && last.startMs === startMs && now - last.ts <= DOUBLE_MS) {
          lastSlotClickRef.current = null;
          if (slotSingleTimerRef.current) {
            clearTimeout(slotSingleTimerRef.current);
            slotSingleTimerRef.current = null;
          }

          if (!canCreateAt(start)) return;
          if (existingHasRange(start, end)) return;
          await createSlot.mutateAsync({
            tenantId,
            start: start.toISOString(),
            end: end.toISOString(),
            mode: "online",
          });
          return;
        }

        // first click → arm single action after DOUBLE_MS
        lastSlotClickRef.current = { ts: now, startMs };
        if (slotSingleTimerRef.current)
          clearTimeout(slotSingleTimerRef.current);
        slotSingleTimerRef.current = window.setTimeout(async () => {
          // still the same armed slot?
          if (
            !lastSlotClickRef.current ||
            lastSlotClickRef.current.startMs !== startMs
          )
            return;
          lastSlotClickRef.current = null;
          if (isMutating || !canCreateAt(start) || existingHasRange(start, end))
            return;
          await createSlot.mutateAsync({
            tenantId,
            start: start.toISOString(),
            end: end.toISOString(),
            mode: "online",
          });
        }, DOUBLE_MS);
      } finally {
        inFlightSlotKeys.current.delete(startMs);
      }
    },
    [tenantQ.data?.id, isMutating, createSlot, existingHasRange, canCreateAt]
  );

  // Handle double-click on existing event to remove slot (immediate action)
  const onDoubleClickEvent = useCallback(
    async (event: RbcEvent) => {
      if (event.resource.status !== "available") return;

      // Check in-flight lock for this event
      if (inFlightEventIds.current.has(event.id)) return;
      inFlightEventIds.current.add(event.id);

      try {
        // Cancel any pending single-click actions
        if (eventSingleTimerRef.current) {
          clearTimeout(eventSingleTimerRef.current);
          eventSingleTimerRef.current = null;
        }
        lastEventClickRef.current = null;
        await removeSlot.mutateAsync({ bookingId: event.id });
      } finally {
        inFlightEventIds.current.delete(event.id);
      }
    },
    [removeSlot]
  );

  // Handle single-click event selection for removal
  const onSelectEvent = useCallback(
    async (event: RbcEvent) => {
      if (isMutating || event.resource.status !== "available") return;

      // Check in-flight lock for this event
      if (inFlightEventIds.current.has(event.id)) return;
      inFlightEventIds.current.add(event.id);

      try {
        const now = Date.now();
        const last = lastEventClickRef.current;

        // second click → cancel single + remove immediately
        if (last && last.id === event.id && now - last.ts <= DOUBLE_MS) {
          lastEventClickRef.current = null;
          if (eventSingleTimerRef.current) {
            clearTimeout(eventSingleTimerRef.current);
            eventSingleTimerRef.current = null;
          }
          await removeSlot.mutateAsync({ bookingId: event.id });
          return;
        }

        // first click → arm single remove after DOUBLE_MS
        lastEventClickRef.current = { ts: now, id: event.id };
        if (eventSingleTimerRef.current)
          clearTimeout(eventSingleTimerRef.current);
        eventSingleTimerRef.current = window.setTimeout(async () => {
          if (
            !lastEventClickRef.current ||
            lastEventClickRef.current.id !== event.id
          )
            return;
          lastEventClickRef.current = null;
          await removeSlot.mutateAsync({ bookingId: event.id });
        }, DOUBLE_MS);
      } finally {
        inFlightEventIds.current.delete(event.id);
      }
    },
    [isMutating, removeSlot]
  );

  if (tenantQ.isLoading) {
    return <div>Loading tenant...</div>;
  }

  if (tenantQ.error) {
    return <div>Error loading tenant: {tenantQ.error.message}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div></div> {/* Empty spacer for balance */}
        <CalendarNav
          anchor={anchor}
          onAnchorChange={setAnchor}
          label={navLabel}
          locale={culture}
        />
        <CalendarLegend />
      </div>
      <div
        style={{
          opacity: isMutating ? 0.6 : 1,
          cursor: isMutating ? "progress" : "default",
        }}
      >
        <Calendar
          localizer={rbcLocalizer}
          culture={culture}
          formats={rbcFormats()}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height }}
          onSelectSlot={onSelectSlot}
          onSelectEvent={onSelectEvent}
          onDoubleClickEvent={onDoubleClickEvent}
          selectable
          toolbar={false} // hide RBC toolbar
          date={anchor} // controlled date
          view={mode === "week" ? Views.WEEK : Views.MONTH}
          views={{ week: true, month: true }}
          scrollToTime={scrollTo} // Auto-scroll to current time
          step={30} // 30-minute grid (denser for 24h view)
          timeslots={2} // two slots per hour (30min each)
          longPressThreshold={250} // reduces accidental double triggers on mobile
          min={new Date(0, 0, 0, 0, 0, 0)} // 00:00 - Full 24h coverage
          max={new Date(0, 0, 0, 23, 59, 59, 999)} // 23:59 - End of day
          eventPropGetter={eventPropGetter} // Color-code events
          slotPropGetter={slotPropGetter} // Visually mute past hours
          tooltipAccessor={tooltipAccessor} // Show time tooltips like italki
        />
      </div>
    </div>
  );
}
