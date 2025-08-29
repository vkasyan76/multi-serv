"use client";

import { Calendar, Views } from "react-big-calendar";
import type {
  SlotInfo,
  EventPropGetter,
  SlotPropGetter,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/trpc/routers/_app";

import {
  startOfDay,
  endOfDay,
  startOfHour,
  addHours,
  addDays,
} from "date-fns";
import { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Booking } from "@/payload-types";
import { getLocaleAndCurrency } from "@/modules/profile/location-utils";
import CalendarNav from "@/modules/bookings/ui/CalendarNav";
import { CalendarLegend } from "./CalendarLegend";

import {
  rbcLocalizer,
  rbcFormats,
  getCultureFromProfile,
  intlFormatters,
  rolling,
} from "../utils/dates-utils";
import { useMediaQuery } from "./use-media";

type Props = {
  tenantSlug: string;
  height?: number | string; // default 520px - controls internal scroll viewport
  defaultStartHour?: number; // default 8 - used to build scrollToTime
  editable?: boolean; // default false - controls DnD and mutation features
};

type RbcEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Booking; // your payload Booking doc
};

// DnD-enhanced Calendar and type definitions
const DnDCalendar = withDragAndDrop(Calendar<RbcEvent, object>);

type EventDropArgs<TEvent> = { 
  event: TEvent; 
  start: string | Date; 
  end: string | Date; 
  isAllDay?: boolean; 
};

type ResizeArgs<TEvent> = { 
  event: TEvent; 
  start: string | Date; 
  end: string | Date; 
};

// Rolling week functionality now managed in dates-utils.ts

export default function TenantCalendar({
  tenantSlug,
  height = 520,
  defaultStartHour = 8,
  editable = false,
}: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Responsive breakpoint detection
  const isMobile = useMediaQuery("(max-width: 640px)");

  // DnD enabled only when editable and not mobile
  const dndEnabled = editable && !isMobile;

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

  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));

  // Responsive view: Day on mobile, Week on desktop
  const activeView = isMobile ? Views.DAY : Views.WEEK;

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

  // Snap to hour, enforce 1h duration, disallow 23:00 starts
  const normalizeHourMove = useCallback((rawStart: Date) => {
    const s = startOfHour(new Date(rawStart));
    if (s.getHours() === 23) return null; // your policy
    const e = addHours(s, 1);
    return { s, e };
  }, []);



  // Keep range in sync with activeView and anchor changes
  useEffect(() => {
    if (activeView === Views.WEEK) {
      const start = startOfDay(anchor);
      const end = endOfDay(addDays(start, 6));
      setRange({ start, end });
    } else {
      // Day view: single day range
      const start = startOfDay(anchor);
      const end = endOfDay(anchor);
      setRange({ start, end });
    }
  }, [activeView, anchor]);

  // Keep the localizer in sync with our UI mode and anchor
  useEffect(() => {
    rolling.useRollingWeek = activeView === Views.WEEK;
    rolling.anchor = startOfDay(anchor);
  }, [activeView, anchor]);

  // Navigation label using the existing formatters
  const navLabel = useMemo(() => {
    const dayFmt = new Intl.DateTimeFormat(culture, { weekday: "short", month: "short", day: "numeric" });
    const rngFmt = new Intl.DateTimeFormat(culture, { weekday: "short", month: "short", day: "numeric" });

    if (isMobile) return dayFmt.format(anchor);                // e.g., "Thu, 28 Aug"
    return `${rngFmt.format(anchor)} — ${rngFmt.format(addDays(anchor, 6))}`;
  }, [isMobile, anchor, culture]);

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
    if (process.env.NODE_ENV !== "production") {
      console.log("Calendar range - Local:", range.start, "to", range.end);
      console.log(
        "Calendar range - UTC:",
        range.start.toISOString(),
        "to",
        range.end.toISOString()
      );
      console.log("Slots returned:", slotsQ.data?.length || 0);
    }
  }, [range, slotsQ.data]);

  // Overlap check that ignores the event being moved
  const existingHasRangeExcluding = useCallback(
    (start: Date, end: Date, excludeId?: string) => {
      const items = slotsQ.data ?? [];
      const s = +start;
      const e = +end;
      return items.some((b) => {
        if (b.id === excludeId) return false;
        const bs = +new Date(b.start);
        const be = +new Date(b.end);
        return bs < e && be > s;
      });
    },
    [slotsQ.data]
  );

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

  // Cleanup timers and refs on unmount to prevent memory leaks
  useEffect(() => {
    const idsRef = inFlightEventIds;
    const keysRef = inFlightSlotKeys;

    return () => {
      // Clean up any pending timers on unmount
      if (slotSingleTimerRef.current) clearTimeout(slotSingleTimerRef.current);
      if (eventSingleTimerRef.current) clearTimeout(eventSingleTimerRef.current);
      // Clear in-flight tracking
      idsRef.current.clear();
      keysRef.current.clear();
    };
  }, []);

  // Minimal header sync effect - only scrollbar compensation
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let ro1: ResizeObserver | null = null;
    let ro2: ResizeObserver | null = null;

    const headerRoot = root.querySelector<HTMLElement>(".rbc-time-header");
    const body = root.querySelector<HTMLElement>(".rbc-time-content");
    if (!headerRoot || !body) return;

    const apply = () => {
      const sb = body.offsetWidth - body.clientWidth; // scrollbar width
      const next = sb > 0 ? `${sb}px` : "0px";
      if (headerRoot.style.marginRight !== next) {
        headerRoot.style.marginRight = next;
      }
    };

    apply();
    const rafApply = () => requestAnimationFrame(apply);
    ro1 = new ResizeObserver(rafApply); ro1.observe(body);
    ro2 = new ResizeObserver(rafApply); ro2.observe(root);
    window.addEventListener("resize", rafApply);

    return () => {
      ro1?.disconnect(); ro2?.disconnect();
      window.removeEventListener("resize", rafApply);
      headerRoot.style.marginRight = "";
    };
  }, [activeView, anchor]);

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

  // Slot move/resize mutation
  const moveSlot = useMutation({
    ...trpc.bookings.updateSlotTime.mutationOptions(),
    onSuccess: invalidateSlots,
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      console.error("Failed to move/resize slot:", err);
      invalidateSlots(); // snap back to server truth
    },
  });

  const isMutating = createSlot.isPending || removeSlot.isPending || moveSlot.isPending;

  // Ref for precise header-body scrollbar compensation
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  // DnD accessors - only "available" slots can be dragged/resized
  const draggableAccessor = useCallback(
    (e: RbcEvent) => e.resource.status === "available",
    []
  );
  const resizableAccessor = draggableAccessor;

  // Drag-drop move handler
  const onEventDrop = useCallback(
    async ({ event, start }: EventDropArgs<RbcEvent>) => {
      if (event.resource.status !== "available") return;

      const startDate = typeof start === "string" ? new Date(start) : start;
      const norm = normalizeHourMove(startDate);
      if (!norm) return;
      const { s, e } = norm;

      if (!canCreateAt(s)) return;
      if (existingHasRangeExcluding(s, e, event.id)) return;

      try {
        await moveSlot.mutateAsync({
          bookingId: event.id,
          start: s.toISOString(),
          end: e.toISOString(),
        });
      } catch {
        // Error handled by mutation onError
      }
    },
    [moveSlot, canCreateAt, existingHasRangeExcluding, normalizeHourMove]
  );

  // Resize handler (we still normalize to 1h; if later you allow variable lengths, use `end` from args)
  const onEventResize = useCallback(
    async ({ event, start }: ResizeArgs<RbcEvent>) => {
      if (event.resource.status !== "available") return;

      const startDate = typeof start === "string" ? new Date(start) : start;
      const norm = normalizeHourMove(startDate);
      if (!norm) return;
      const { s, e } = norm;

      if (!canCreateAt(s)) return;
      if (existingHasRangeExcluding(s, e, event.id)) return;

      try {
        await moveSlot.mutateAsync({
          bookingId: event.id,
          start: s.toISOString(),
          end: e.toISOString(),
        });
      } catch {
        // Error handled by mutation onError
      }
    },
    [moveSlot, canCreateAt, existingHasRangeExcluding, normalizeHourMove]
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
        // FAST PATH ON MOBILE: create immediately (no extra 300ms delay)
        if (isMobile) {
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
    [tenantQ.data?.id, isMutating, createSlot, existingHasRange, canCreateAt, isMobile]
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
    <div ref={rootRef} className="relative w-full min-w-0 overflow-x-hidden">
      {/* Header: column on mobile, row on desktop */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CalendarNav
          anchor={anchor}
          onAnchorChange={setAnchor}
          label={navLabel}
          locale={culture}
          compact={isMobile}
          showWeekJumps={!isMobile}
          className="w-full sm:w-auto"
        />
        {/* On mobile this naturally drops below the nav */}
        <CalendarLegend className="sm:ml-4" />
      </div>
      <div
        style={{
          opacity: isMutating ? 0.6 : 1,
          cursor: isMutating ? "progress" : "default",
        }}
      >
        <DndProvider backend={HTML5Backend}>
          {/* Horizontal scroll container prevents grid collapse on narrow screens */}
          <div className={isMobile ? "-mx-3 sm:mx-0 overflow-x-hidden" : "mx-0 overflow-x-hidden"}>
            {/* Ensure a sensible min width on phones; desktop uses full width */}
            <div className="min-w-0">
              {dndEnabled ? (
                <DnDCalendar
                  localizer={rbcLocalizer}
                  culture={culture}
                  formats={rbcFormats()}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: isMobile ? "70vh" : height }}
                  onSelectSlot={editable ? onSelectSlot : undefined}
                  onSelectEvent={editable ? onSelectEvent : undefined}
                  onDoubleClickEvent={editable ? onDoubleClickEvent : undefined}
                  selectable={editable ? "ignoreEvents" : false}
                  toolbar={false} // hide RBC toolbar
                  date={anchor} // controlled date
                  view={activeView}
                  views={isMobile ? { day: true } : { week: true, month: true }}
                  scrollToTime={scrollTo} // Auto-scroll to current time
                  step={30} // 30-minute grid (denser for 24h view)
                  timeslots={2} // two slots per hour (30min each)
                  longPressThreshold={120} // faster touch response on mobile
                  min={new Date(0, 0, 0, 0, 0, 0)} // 00:00 - Full 24h coverage
                  max={new Date(0, 0, 0, 23, 59, 59, 999)} // 23:59 - End of day
                  eventPropGetter={eventPropGetter} // Color-code events
                  slotPropGetter={slotPropGetter} // Visually mute past hours
                  tooltipAccessor={tooltipAccessor} // Show time tooltips like italki
                  // DnD props
                  draggableAccessor={draggableAccessor}
                  resizableAccessor={resizableAccessor}
                  onEventDrop={onEventDrop}
                  onEventResize={onEventResize}
                  resizable
                />
              ) : (
                <Calendar
                  localizer={rbcLocalizer}
                  culture={culture}
                  formats={rbcFormats()}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: isMobile ? "70vh" : height }}
                  onSelectSlot={editable ? onSelectSlot : undefined}
                  onSelectEvent={editable ? onSelectEvent : undefined}
                  onDoubleClickEvent={editable ? onDoubleClickEvent : undefined}
                  selectable={editable ? "ignoreEvents" : false}
                  toolbar={false} // hide RBC toolbar
                  date={anchor} // controlled date
                  view={activeView}
                  views={isMobile ? { day: true } : { week: true, month: true }}
                  scrollToTime={scrollTo} // Auto-scroll to current time
                  step={30} // 30-minute grid (denser for 24h view)
                  timeslots={2} // two slots per hour (30min each)
                  longPressThreshold={120} // faster touch response on mobile
                  min={new Date(0, 0, 0, 0, 0, 0)} // 00:00 - Full 24h coverage
                  max={new Date(0, 0, 0, 23, 59, 59, 999)} // 23:59 - End of day
                  eventPropGetter={eventPropGetter} // Color-code events
                  slotPropGetter={slotPropGetter} // Visually mute past hours
                  tooltipAccessor={tooltipAccessor} // Show time tooltips like italki
                />
              )}
            </div>
          </div>
        </DndProvider>
      </div>
    </div>
  );
}
