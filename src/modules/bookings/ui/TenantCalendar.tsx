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

import { startOfDay, endOfDay, startOfHour, addHours, addDays } from "date-fns";
import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Booking, User } from "@/payload-types";
import { getLocaleAndCurrency } from "@/modules/profile/location-utils";
import CalendarNav from "@/modules/bookings/ui/CalendarNav";
import { CalendarLegend } from "./CalendarLegend";
import { BOOKING_CH } from "@/constants";

import {
  rbcLocalizer,
  rbcFormats,
  getCultureFromProfile,
  intlFormatters,
  rolling,
} from "../utils/dates-utils";
import { useMediaQuery } from "./use-media";

// Type definitions for type-safe BroadcastChannel operations
type BookingBroadcast =
  | { type: "slot:created"; tenantSlug: string; id: string; ts: number }
  | { type: "slot:removed"; tenantSlug: string; id: string; ts: number }
  | {
      type: "slot:moved";
      tenantSlug: string;
      id: string;
      start: string;
      end: string;
      ts: number;
    }
  | { type: "booking:updated"; tenantSlug: string; ids?: string[]; ts: number };

// tiny helper to recognize our payloads
const isBroadcast = (d: unknown): d is BookingBroadcast =>
  !!d && typeof d === "object" && "type" in (d as Record<string, unknown>);

// Helper to read tRPC error codes safely
const trpcCode = (err: unknown): string | undefined => {
  if (
    err &&
    typeof err === "object" &&
    "data" in err &&
    err.data &&
    typeof err.data === "object" &&
    "code" in err.data
  ) {
    return err.data.code as string;
  }
  return undefined;
};

// Type for slot move variables
type SlotMoveVars = { bookingId: string; start: string; end: string };

type Props = {
  tenantSlug: string;
  height?: number | string; // default 520px - controls internal scroll viewport
  defaultStartHour?: number; // default 8 - used to build scrollToTime
  editable?: boolean; // default false - controls DnD and mutation features
  selectForBooking?: boolean; // default false - controls if slots can be selected for booking
  selectedIds?: string[]; // default [] - list of selected booking IDs
  onToggleSelect?: (id: string) => void; // callback to toggle selection
};

type RbcEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: BookingWithName; // now strongly typed
};

// Import the type from procedures to ensure consistency
import type { BookingWithName } from "@/modules/bookings/server/procedures";

// DnD-enhanced Calendar and type definitions
const DnDCalendar = withDragAndDrop(Calendar<RbcEvent, BookingWithName>);

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
  selectForBooking = false,
  selectedIds = [],
  onToggleSelect,
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
  const normalizeHourMove = useCallback(
    (rawStart: Date): { s: Date; e: Date } | null => {
      const s = startOfHour(new Date(rawStart));
      if (s.getHours() === 23) return null; // your policy
      const e = addHours(s, 1);
      return { s, e };
    },
    []
  );

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

  // NEW: Listen for broadcast messages from other tabs
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window))
      return;

    const ch = new BroadcastChannel(BOOKING_CH);
    const onMsg = (ev: MessageEvent<BookingBroadcast>) => {
      const d = ev.data;
      if (!isBroadcast(d) || d.tenantSlug !== tenantSlug) return;
      if (
        d.type !== "slot:created" &&
        d.type !== "slot:removed" &&
        d.type !== "slot:moved" &&
        d.type !== "booking:updated"
      )
        return;

      if (d.type === "slot:removed" && d.id) {
        // Instant prune when a removal comes in (optional performance boost)
        // Update public slots query
        queryClient.setQueryData(
          trpc.bookings.listPublicSlots.queryKey({
            tenantSlug,
            from: range.start.toISOString(),
            to: range.end.toISOString(),
          }),
          (prev: Booking[] | undefined) => prev?.filter((b) => b.id !== d.id)
        );

        // If on dashboard, also update the mine query
        if (editable && tenantQ.data?.id) {
          queryClient.setQueryData(
            trpc.bookings.listMine.queryKey({
              tenantId: tenantQ.data.id,
              from: range.start.toISOString(),
              to: range.end.toISOString(),
            }),
            (prev: BookingWithName[] | undefined) =>
              prev?.filter((b) => b.id !== d.id)
          );
        }
      }

      if (d.type === "slot:moved" && d.id && d.start && d.end) {
        // patch in-place so the move is visible immediately
        const patches = queryClient.getQueriesData<BookingWithName[]>({
          predicate: (q) => {
            const s = JSON.stringify(q.queryKey ?? []);
            return (
              s.includes('"bookings"') &&
              (s.includes('"listPublicSlots"') || s.includes('"listMine"'))
            );
          },
        });
        for (const [key, arr] of patches) {
          if (!arr) continue;
          queryClient.setQueryData<BookingWithName[]>(
            key,
            arr.map((b) =>
              b.id === d.id ? { ...b, start: d.start, end: d.end } : b
            )
          );
        }
      }

      // keep existing global invalidation so everything stays consistent
      queryClient.invalidateQueries({
        predicate: (q) => {
          const s = JSON.stringify(q.queryKey ?? []);
          return (
            s.includes('"bookings"') &&
            (s.includes("listPublicSlots") || s.includes("listMine"))
          );
        },
      });
    };
    ch.addEventListener("message", onMsg);

    return () => {
      ch.close();
    };
  }, [tenantSlug, queryClient, range.start, range.end]);

  // Navigation label using the existing formatters
  const navLabel = useMemo(() => {
    const dayFmt = new Intl.DateTimeFormat(culture, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const rngFmt = new Intl.DateTimeFormat(culture, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    if (isMobile) return dayFmt.format(anchor); // e.g., "Thu, 28 Aug"
    return `${rngFmt.format(anchor)} — ${rngFmt.format(addDays(anchor, 6))}`;
  }, [isMobile, anchor, culture]);

  // Load tenant (to get tenantId for creating slots)
  const tenantQ = useQuery(
    trpc.tenants.getOne.queryOptions({ slug: tenantSlug })
  );

  // Load slots for the visible range - branch between dashboard and public views
  const baseOpts = editable
    ? trpc.bookings.listMine.queryOptions({
        tenantId: tenantQ.data?.id || "",
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      })
    : trpc.bookings.listPublicSlots.queryOptions({
        tenantSlug,
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      });

  const slotsQ = useQuery({
    ...baseOpts,
    // keep previous data visible during fetch => no flash
    placeholderData: (prev) => prev,
    // avoid focus-triggered refetches
    refetchOnWindowFocus: false,
    // tiny payloads; 5s is smooth on dashboard, 60s is fine on public
    refetchInterval: editable ? 5000 : 60000,
    // helps avoid redundant re-fetches
    staleTime: 30_000,
    // only enable dashboard query when we have tenantId
    enabled: !editable || !!tenantQ.data?.id,
  });

  // Debug logging to help verify ranges and data
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

      // Debug customer names for booked slots
      const oneBooked = (slotsQ.data ?? []).find(
        (b) => b.status !== "available"
      );
      if (oneBooked) {
        console.log("Booked sample:", {
          id: oneBooked.id,
          status: oneBooked.status,
          customer: oneBooked.customer,
          customerType: typeof oneBooked.customer,
        });
      }
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
      if (eventSingleTimerRef.current)
        clearTimeout(eventSingleTimerRef.current);
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
    ro1 = new ResizeObserver(rafApply);
    ro1.observe(body);
    ro2 = new ResizeObserver(rafApply);
    ro2.observe(root);
    window.addEventListener("resize", rafApply);

    return () => {
      ro1?.disconnect();
      ro2?.disconnect();
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
        (b: BookingWithName) =>
          new Date(b.start).getTime() === s && new Date(b.end).getTime() === e
      );
    },
    [slotsQ.data]
  );

  // Query invalidation helper - invalidate both query types
  const invalidateSlots = useCallback(() => {
    // Invalidate public slots query
    queryClient.invalidateQueries({
      queryKey: trpc.bookings.listPublicSlots.queryKey({
        tenantSlug,
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      }),
    });

    // If on dashboard, also invalidate the mine query
    if (editable && tenantQ.data?.id) {
      queryClient.invalidateQueries({
        queryKey: trpc.bookings.listMine.queryKey({
          tenantId: tenantQ.data.id,
          from: range.start.toISOString(),
          to: range.end.toISOString(),
        }),
      });
    }
  }, [
    queryClient,
    tenantSlug,
    range.start,
    range.end,
    editable,
    tenantQ.data?.id,
    trpc.bookings.listPublicSlots,
    trpc.bookings.listMine,
  ]);

  // Slot creation mutation with proper query invalidation and error handling
  const createSlot = useMutation({
    ...trpc.bookings.createAvailableSlot.mutationOptions(),
    onSuccess: (result) => {
      invalidateSlots();

      // Notify other tabs about the new slot
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        try {
          const ch = new BroadcastChannel(BOOKING_CH);
          ch.postMessage({
            type: "slot:created",
            tenantSlug,
            id: result.id,
            ts: Date.now(),
          });
          ch.close();
        } catch {}
      }
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      if (err.data?.code === "CONFLICT") return; // legit double click
      console.error("Failed to create slot:", err);
    },
  });

  // Slot removal mutation
  const removeSlot = useMutation({
    ...trpc.bookings.removeSlot.mutationOptions(),
    onSuccess: (_result, variables: { bookingId: string }) => {
      invalidateSlots();

      // Notify other tabs about the removed slot
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        try {
          const ch = new BroadcastChannel(BOOKING_CH);
          ch.postMessage({
            type: "slot:removed",
            tenantSlug,
            id: variables.bookingId, // the removed slot ID
            ts: Date.now(),
          });
          ch.close();
        } catch {}
      }
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      console.error("Failed to remove slot:", err);
    },
  });

  // Slot move/resize mutation
  const moveSlot = useMutation({
    ...trpc.bookings.updateSlotTime.mutationOptions(),

    // Optimistic update so the dashboard calendar snaps immediately
    onMutate: async (vars: SlotMoveVars) => {
      const { bookingId, start, end } = vars;

      // snapshot relevant caches (both listPublicSlots and listMine queries)
      const snapshots = queryClient.getQueriesData<BookingWithName[]>({
        predicate: (q) => {
          const s = JSON.stringify(q.queryKey ?? []);
          return (
            s.includes('"bookings"') &&
            (s.includes('"listPublicSlots"') || s.includes('"listMine"'))
          );
        },
      });

      // patch all caches where this slot exists
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData<BookingWithName[]>(
          key,
          data.map((b) => (b.id === bookingId ? { ...b, start, end } : b))
        );
      }

      // pass snapshots for rollback
      return { snapshots };
    },

    // If the server rejects, restore previous cache state
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        ctx.snapshots.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },

    // Broadcast to other tabs/pages so tenant-content updates instantly
    onSuccess: (_res, vars: SlotMoveVars) => {
      try {
        const ch = new BroadcastChannel(BOOKING_CH);
        ch.postMessage({
          type: "slot:moved",
          tenantSlug,
          id: vars.bookingId,
          start: vars.start,
          end: vars.end,
          ts: Date.now(),
        });
        ch.close();
      } catch {}
    },

    // Still refetch to sync with server truth
    onSettled: () => {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const s = JSON.stringify(q.queryKey ?? []);
          return (
            s.includes('"bookings"') &&
            (s.includes('"listPublicSlots"') || s.includes('"listMine"'))
          );
        },
      });
    },
  });

  const isMutating =
    createSlot.isPending || removeSlot.isPending || moveSlot.isPending;

  // Helper to compute the display name from either customerName or populated user
  const displayName = useCallback((b: BookingWithName): string | undefined => {
    if (b.customerName) return b.customerName;
    if (b.customer && typeof b.customer === "object") {
      const u = b.customer as User;
      return u.username ?? u.email ?? undefined;
    }
    return undefined;
  }, []);

  // Ref for precise header-body scrollbar compensation
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Custom event component for dashboard to always show customer names
  const DashboardEvent: React.FC<{ event: RbcEvent }> = ({ event }) => {
    const b = event.resource; // typed as BookingWithName
    if (b.status === "available") return null; // green blocks stay clean

    const who = b.customerName ?? "Booked";
    return <div className="rbc-dash-ev truncate">{who}</div>;
  };

  // Map bookings -> RBC events with UI cleanup for past available slots
  const events: RbcEvent[] = useMemo(() => {
    const nowMs = nowTick;
    return (slotsQ.data ?? [])
      .filter((b) => {
        const startMs = new Date(b.start).getTime();
        switch (b.status) {
          case "booked":
          case "confirmed":
            return true; // always show (past + future)
          case "available":
            return startMs > nowMs; // hide past available, show only future
          default:
            return false;
        }
      })
      .map((b) => {
        const bookedTitle = editable
          ? (displayName(b as BookingWithName) ?? "Booked")
          : "Booked";

        return {
          id: b.id,
          title: b.status === "available" ? "" : bookedTitle,
          start: new Date(b.start),
          end: new Date(b.end),
          resource: b as BookingWithName,
        };
      });
  }, [slotsQ.data, nowTick, editable, displayName]);

  // Handle slot selection (controlled - no internal state)
  const handleSlotSelect = useCallback(
    (event: RbcEvent) => {
      if (!selectForBooking || !onToggleSelect) return;
      if (event.resource.status !== "available") return;
      if (event.start.getTime() <= Date.now()) return;

      onToggleSelect(event.id);
    },
    [selectForBooking, onToggleSelect]
  );

  // Color-code events and tag by status for CSS styling
  const eventPropGetter: EventPropGetter<RbcEvent> = useCallback(
    (event) => {
      const isAvailable = event.resource.status === "available";
      const isSelected =
        selectForBooking && isAvailable && selectedIds.includes(event.id);

      if (isAvailable && isSelected) {
        return {
          className: "ring-2 ring-gray-500",
          style: {
            backgroundColor: "#e5e7eb",
            borderColor: "#6b7280",
            color: "#111827",
          },
        };
      } else if (isAvailable) {
        return {
          className: "ev-available",
          style: {
            backgroundColor: "#86efac",
            border: "none",
            color: "#111827",
          },
        };
      } else {
        return {
          className: "ev-booked",
          style: {
            backgroundColor: "#fbbf24",
            border: "none",
            color: "#111827",
          },
        };
      }
    },
    [selectForBooking, selectedIds]
  );

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
        // For booked events, show customer name on dashboard, "Booked" on public
        const who = editable
          ? (displayName(e.resource as BookingWithName) ?? "Booked")
          : "Booked";
        return `${who} - ${dateFmt.format(e.start)}`;
      }
    },
    [dateFmt, editable, displayName]
  );

  // DnD accessors - only "available" slots can be dragged/resized
  const draggableAccessor = useCallback(
    (e: RbcEvent): boolean => e.resource.status === "available",
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
          if (createSlot.isPending || removeSlot.isPending) return; // prevent double-firing
          try {
            await createSlot.mutateAsync({
              tenantId,
              start: start.toISOString(),
              end: end.toISOString(),
              mode: "online",
            });
          } catch (err: unknown) {
            // Ignore benign conflicts from double-clicks / slow re-renders
            if (trpcCode(err) !== "CONFLICT") {
              console.error("Failed to create slot:", err);
            }
          }
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
          if (createSlot.isPending || removeSlot.isPending) return; // prevent double-firing
          try {
            await createSlot.mutateAsync({
              tenantId,
              start: start.toISOString(),
              end: end.toISOString(),
              mode: "online",
            });
          } catch (err: unknown) {
            // Ignore benign conflicts from double-clicks / slow re-renders
            if (trpcCode(err) !== "CONFLICT") {
              console.error("Failed to create slot:", err);
            }
          }
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
          if (createSlot.isPending || removeSlot.isPending) return; // prevent double-firing
          try {
            await createSlot.mutateAsync({
              tenantId,
              start: start.toISOString(),
              end: end.toISOString(),
              mode: "online",
            });
          } catch (err: unknown) {
            // Ignore benign conflicts from double-clicks / slow re-renders
            if (trpcCode(err) !== "CONFLICT") {
              console.error("Failed to create slot:", err);
            }
          }
        }, DOUBLE_MS);
      } finally {
        inFlightSlotKeys.current.delete(startMs);
      }
    },
    [
      tenantQ.data?.id,
      isMutating,
      createSlot,
      existingHasRange,
      canCreateAt,
      isMobile,
    ]
  );

  // Handle double-click on existing event to remove slot (immediate action)
  const onDoubleClickEvent = useCallback(
    async (event: RbcEvent) => {
      // Ignore double-clicks in booking mode
      if (selectForBooking) return;

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
        if (createSlot.isPending || removeSlot.isPending) return; // prevent double-firing
        try {
          await removeSlot.mutateAsync({ bookingId: event.id });
        } catch (err: unknown) {
          // Ignore benign conflicts from double-clicks / slow re-renders
          if (trpcCode(err) !== "NOT_FOUND") {
            console.error("Failed to delete slot:", err);
          }
        }
      } finally {
        inFlightEventIds.current.delete(event.id);
      }
    },
    [selectForBooking, removeSlot]
  );

  // Handle single-click event selection for removal or booking
  const onSelectEvent = useCallback(
    async (event: RbcEvent) => {
      // Handle booking selection mode
      if (selectForBooking && onToggleSelect) {
        handleSlotSelect(event);
        return;
      }

      // Handle removal mode (dashboard only)
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
    [selectForBooking, onToggleSelect, handleSlotSelect, isMutating, removeSlot]
  );

  if (tenantQ.isLoading) {
    return <div>Loading tenant...</div>;
  }

  if (tenantQ.error) {
    return <div>Error loading tenant: {tenantQ.error.message}</div>;
  }

  return (
    <div
      ref={rootRef}
      className={`relative w-full min-w-0 overflow-x-hidden ${editable ? "calendar--dashboard" : ""}`}
    >
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
          <div
            className={
              isMobile
                ? "px-3 sm:px-0 overflow-x-hidden"
                : "mx-0 overflow-x-hidden"
            }
          >
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
                  onSelectEvent={
                    editable || selectForBooking ? onSelectEvent : undefined
                  }
                  onDoubleClickEvent={
                    editable || selectForBooking
                      ? onDoubleClickEvent
                      : undefined
                  }
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
                  // Custom event component for dashboard to show customer names
                  components={editable ? { event: DashboardEvent } : undefined}
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
                  onSelectEvent={
                    editable || selectForBooking ? onSelectEvent : undefined
                  }
                  onDoubleClickEvent={
                    editable || selectForBooking
                      ? onDoubleClickEvent
                      : undefined
                  }
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
                  // Custom event component for dashboard to show customer names
                  components={editable ? { event: DashboardEvent } : undefined}
                />
              )}
            </div>
          </div>
        </DndProvider>
      </div>

      {/* Dashboard-specific CSS for balanced padding */}
      {editable && (
        <style jsx global>{`
          /* Add balanced padding to the name line */
          .calendar--dashboard .ev-booked .rbc-event-content {
            padding: 4px 6px; /* top/bottom + left/right */
            display: flex;
            align-items: center; /* vertically center the single line */
          }
          /* Optional: a little space between label (time) and content (name) */
          .calendar--dashboard .ev-booked .rbc-event-label {
            margin-bottom: 2px;
          }
          /* If your custom content uses a helper class */
          .calendar--dashboard .rbc-dash-ev {
            line-height: 1.1;
          }
        `}</style>
      )}
    </div>
  );
}
