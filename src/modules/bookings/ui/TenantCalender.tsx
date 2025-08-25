"use client";

import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import type { SlotInfo } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, startOfWeek as dfStartOfWeek, endOfWeek as dfEndOfWeek } from "date-fns";
import { useMemo, useState, useCallback, useEffect } from "react";
import { startOfHour, addHours } from "date-fns";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Booking } from "@/payload-types";

type Props = {
  tenantSlug: string;
};

const locales = {};
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export default function TenantCalendar({ tenantSlug }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Which week is visible
  const [range, setRange] = useState(() => {
    const start = dfStartOfWeek(new Date(), { weekStartsOn: 1 });
    const end = dfEndOfWeek(new Date(), { weekStartsOn: 1 });
    return { start, end };
  });

  // Load tenant (to get tenantId for creating slots)
  const tenantQ = useQuery(trpc.tenants.getOne.queryOptions({ slug: tenantSlug }));

  // Load slots for the visible range - v5 correct syntax
  const slotsQ = useQuery({
    ...trpc.bookings.listPublicSlots.queryOptions({
      tenantSlug,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    }),
    placeholderData: (prev: Booking[] | undefined) => prev,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Debug logging to help verify ranges
  useEffect(() => {
    console.log("Calendar range - Local:", range.start, "to", range.end);
    console.log("Calendar range - UTC:", range.start.toISOString(), "to", range.end.toISOString());
    console.log("Slots returned:", slotsQ.data?.length || 0);
  }, [range, slotsQ.data]);

  // Helper to detect duplicate slots
  const existingHasRange = useCallback((start: Date, end: Date) => {
    const items = slotsQ.data ?? [];
    const s = start.getTime();
    const e = end.getTime();
    return items.some(b => new Date(b.start).getTime() === s && new Date(b.end).getTime() === e);
  }, [slotsQ.data]);

  // Slot creation mutation with proper query invalidation and error handling
  const createSlot = useMutation({
    ...trpc.bookings.createAvailableSlot.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.bookings.listPublicSlots.queryKey({
          tenantSlug,
          from: range.start.toISOString(),
          to: range.end.toISOString(),
        }),
      });
    },
    onError: (err: any) => {
      if (err?.data?.code === "CONFLICT") return; // silent on legit duplicate
      console.error("Failed to create slot:", err);
    },
  });

  // Map bookings -> RBC events
  const events = useMemo(() => {
    return (slotsQ.data ?? []).map((b: Booking) => ({
      id: b.id,
      title: b.status === "available" ? "Available" : "Booked",
      start: new Date(b.start),
      end: new Date(b.end),
      resource: b,
    }));
  }, [slotsQ.data]);

  // Color-code events for visual clarity
  const eventPropGetter = useCallback((e: any) => ({
    style: {
      backgroundColor: e.resource?.status === "available" ? "#86efac" : "#e5e7eb",
      border: "none",
      color: "#111827",
    },
  }), []);

  // Handle date range changes with defensive boundaries
  const onRangeChange = useCallback((next: any) => {
    if (Array.isArray(next)) {
      // month view provides an array; take first/last date
      if (next[0] && next[next.length - 1]) {
        setRange({
          start: startOfDay(next[0]),
          end: endOfDay(next[next.length - 1]),
        });
      }
    } else if (next?.start && next?.end) {
      setRange({
        start: startOfDay(next.start),
        end: endOfDay(next.end),
      });
    }
  }, []);

  // Handle slot selection - create new available slot with hour-based logic
  const onSelectSlot = useCallback(async (slotInfo: SlotInfo) => {
    const tenantId = tenantQ.data?.id;
    if (!tenantId) return;

    if (createSlot.isPending) return;

    const start = startOfHour(new Date(slotInfo.start));
    const end = addHours(start, 1);

    if (existingHasRange(start, end)) return;

    await createSlot.mutateAsync({
      tenantId,
      start: start.toISOString(),
      end: end.toISOString(),
      mode: "online",
    });
  }, [createSlot, tenantQ.data?.id, existingHasRange]);

  // Handle event selection
  const onSelectEvent = useCallback((event: any) => {
    // TODO: Implement event selection logic
    console.log("Event selected:", event);
  }, []);

  if (tenantQ.isLoading) {
    return <div>Loading tenant...</div>;
  }

  if (tenantQ.error) {
    return <div>Error loading tenant: {tenantQ.error.message}</div>;
  }

  return (
    <div className="h-[600px]">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        onRangeChange={onRangeChange}
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        selectable
        defaultView={Views.WEEK}
        views={[Views.DAY, Views.WEEK, Views.MONTH]}
        step={60} // 60-minute grid
        timeslots={1} // one slot per hour
        longPressThreshold={250} // reduces accidental double triggers on mobile
        min={new Date(0, 0, 0, 8, 0, 0)} // 8 AM
        max={new Date(0, 0, 0, 20, 0, 0)} // 8 PM
        eventPropGetter={eventPropGetter} // Color-code events
      />
    </div>
  );
}