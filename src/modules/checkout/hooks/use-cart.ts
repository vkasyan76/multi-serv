"use client";

import { useMemo, useCallback } from "react";
import { useCartStore, type CartItem } from "../store/use-cart-store";

const EMPTY: CartItem[] = []; // stable, top-level constant

/** Tenant-scoped cart helpers (tutorial-style ergonomics). */
export function useCart(tenantId: string) {
  // Select slices individually (no object selector → no new refs)
  const tenant = useCartStore((s) => s.tenant);
  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const addMany = useCartStore((s) => s.addMany);
  const remove = useCartStore((s) => s.remove);
  const toggle = useCartStore((s) => s.toggle);
  const clear = useCartStore((s) => s.clear);
  const setOpen = useCartStore((s) => s.setOpen);

  const hasOtherTenant = tenant !== null && tenant !== tenantId;

  // ---- tenant-bound actions ----
  const addSlot = useCallback(
    (item: CartItem) => add(tenantId, item),
    [add, tenantId]
  );
  const addSelected = useCallback(
    (slotItems: CartItem[]) => addMany(tenantId, slotItems),
    [addMany, tenantId]
  );
  const toggleSlot = useCallback(
    (item: CartItem) => toggle(tenantId, item),
    [toggle, tenantId]
  );
  const removeSlot = useCallback((slotId: string) => remove(slotId), [remove]);
  const openCart = useCallback(() => setOpen(true), [setOpen]);
  const closeCart = useCallback(() => setOpen(false), [setOpen]);

  // ---- derived for this tenant ----
  const tenantItems = useMemo(
    () => (hasOtherTenant ? EMPTY : items),
    [hasOtherTenant, items]
  );

  const totalItems = tenantItems.length;

  // avoid reduce typing noise; tiny loop is crystal clear
  const totalPriceCents = useMemo(() => {
    let sum = 0;
    for (const it of tenantItems) sum += it.priceCents;
    return sum;
  }, [tenantItems]);

  const inCart = useCallback(
    (slotId: string) => tenantItems.some((x: CartItem) => x.id === slotId),
    [tenantItems]
  );

  const clearTenantCart = useCallback(() => {
    if (items.length) clear();
  }, [clear, items.length]);

  return {
    // data
    items: tenantItems,
    totalItems,
    totalPriceCents,
    hasOtherTenant,
    // actions
    addSlot,
    addSelected,
    toggleSlot,
    removeSlot,
    clearTenantCart,
    openCart,
    closeCart,
    inCart,
  };
}

/**
 * useCart(tenantId)
 * ------------------
 * Tenant-scoped wrapper around the global cart store.
 *
 * What it does:
 * - Selects only the fields/actions needed from useCartStore (keeps re-renders low).
 * - Binds actions to the provided tenantId: addSlot, addSelected, toggleSlot, removeSlot.
 * - Computes tenant-specific derived data: `items`, `totalItems`, `totalPriceCents`.
 * - Enforces one-tenant-per-order: if the cart belongs to another tenant,
 *   this hook exposes an empty list (`hasOtherTenant` becomes true).
 * - Exposes UI helpers to control the checkout drawer: `openCart` / `closeCart`.
 * - Keeps cart state ephemeral (no localStorage) because time slots can expire
 *   and the app spans multiple origins (subdomains/previews), which would make
 *   persisted carts stale or appear "lost".
 *
 * Typical usage:
 *   const { items, totalItems, inCart, addSlot, addSelected, openCart } = useCart(tenant.slug);
 */
