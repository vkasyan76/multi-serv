"use client";

import { create } from "zustand";

export type CartItem = {
  id: string; // slot id
  startIso: string;
  endIso: string;
  priceCents: number; // rate * duration (in cents)
  serviceId?: string | null;
};

type CartState = {
  tenant: string | null; // one-tenant-per-order guard
  items: CartItem[];
  open: boolean; // controls the checkout sheet/drawer

  // derived
  count: () => number;
  totalCents: () => number;

  // actions
  setOpen: (v: boolean) => void;
  clear: () => void;
  add: (tenant: string, item: CartItem) => boolean; // false => cart has other tenant
  addMany: (tenant: string, items: CartItem[]) => boolean;
  remove: (slotId: string) => void;
  toggle: (tenant: string, item: CartItem) => boolean; // add if absent, remove if present
  setService: (slotId: string, serviceId: string | null) => void;
};

export const useCartStore = create<CartState>((set, get) => ({
  tenant: null,
  items: [],
  open: false,

  // derived
  count: () => get().items.length,
  totalCents: () => get().items.reduce((s, i) => s + i.priceCents, 0),

  // ui
  setOpen: (v) => set({ open: v }),
  clear: () => set({ items: [], tenant: null }),

  // core
  add: (tenant, item) => {
    const s = get();
    if (s.items.length && s.tenant && s.tenant !== tenant) return false;
    set((prev) => {
      const exists = prev.items.some((x) => x.id === item.id);
      return {
        tenant: prev.tenant ?? tenant,
        items: exists ? prev.items : [...prev.items, item],
      };
    });
    return true;
  },

  addMany: (tenant, items) => {
    const s = get();
    if (s.items.length && s.tenant && s.tenant !== tenant) return false;
    set((prev) => {
      const seen = new Set(prev.items.map((x) => x.id));
      const merged = items.filter((x) => !seen.has(x.id));
      return {
        tenant: prev.tenant ?? tenant,
        items: [...prev.items, ...merged],
      };
    });
    return true;
  },

  remove: (slotId) =>
    set((prev) => ({ items: prev.items.filter((x) => x.id !== slotId) })),

  toggle: (tenant, item) => {
    const s = get();
    if (s.items.length && s.tenant && s.tenant !== tenant) return false;
    const exists = s.items.some((x) => x.id === item.id);
    set((prev) => ({
      tenant: prev.tenant ?? tenant,
      items: exists
        ? prev.items.filter((x) => x.id !== item.id)
        : [...prev.items, item],
    }));
    return true;
  },

  setService: (slotId, serviceId) =>
    set((prev) => ({
      items: prev.items.map((x) => (x.id === slotId ? { ...x, serviceId } : x)),
    })),
}));

// Optional helper to build a CartItem from a calendar slot
export function slotToCartItem(
  slot: { id: string; start: string; end: string },
  pricePerHourCents: number
): CartItem {
  const ms = +new Date(slot.end) - +new Date(slot.start);
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  return {
    id: slot.id,
    startIso: slot.start,
    endIso: slot.end,
    priceCents: pricePerHourCents * hours,
  };
}

// NOTE: We intentionally do NOT persist this cart to localStorage.
// 1) Booking slots can disappear or be taken by others. Persisting would
//    resurrect stale items after reload and cause failed checkouts.
// 2) The app runs on multiple origins (tenant subdomains, preview URLs).
//    localStorage is per-origin, so carts would seem to “vanish” between them.
// 3) Avoids SSR/hydration issues from touching localStorage on first paint.
// If we decide to persist later, prefer sessionStorage + server re-validation.
