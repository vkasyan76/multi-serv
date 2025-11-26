// src/scripts/categories-prune-unused.ts
process.env.PAYLOAD_DISABLE_AUTH_FOR_SCRIPTS = "true";

import "dotenv/config";
import { getPayload, type Payload } from "payload";
import config from "../payload.config.js";

import type { Category, Tenant } from "../payload-types";

const DRY_RUN = process.argv.includes("--dry-run");

type IdLike = string | { id?: string | null } | null | undefined;

const toId = (v: IdLike): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && "id" in v && v.id) return String(v.id);
  return null;
};

const idsFromRelArray = (
  arr: Array<string | Category> | null | undefined
): string[] => {
  if (!arr?.length) return [];
  return arr
    .map((v) => (typeof v === "string" ? v : v?.id))
    .filter((x): x is string => Boolean(x));
};

async function fetchAll<T>(
  payload: Payload,
  collection: "categories" | "tenants"
): Promise<T[]> {
  const all: T[] = [];
  const limit = 200;
  let page = 1;

  while (true) {
    const res = await payload.find({
      collection,
      limit,
      page,
      depth: 0,
      overrideAccess: true,
    });

    all.push(...(res.docs as unknown as T[]));

    if (page >= res.totalPages) break;
    page += 1;
  }

  return all;
}

async function run() {
  const payload = await getPayload({ config });

  const [categories, tenants] = await Promise.all([
    fetchAll<Category>(payload, "categories"),
    fetchAll<Tenant>(payload, "tenants"),
  ]);

  // Map categories for reporting + parent-chain keep
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(String(c.id), c);

  // Collect all category IDs referenced by tenants (categories + subcategories)
  const used = new Set<string>();

  for (const t of tenants) {
    for (const id of idsFromRelArray(t.categories)) used.add(String(id));
    for (const id of idsFromRelArray(t.subcategories)) used.add(String(id));
  }

  // Also keep parent chain of all used categories (so we don't delete parents of used subcats)
  const keep = new Set<string>(used);
  for (const id of used) {
    let cur: Category | undefined = byId.get(id);
    while (cur) {
      const parentId = toId(cur.parent as IdLike);
      if (!parentId) break;
      if (keep.has(parentId)) break;
      keep.add(parentId);
      cur = byId.get(parentId);
    }
  }

  const unused = categories.filter((c) => !keep.has(String(c.id)));

  // Delete children first (those with parent), then parents
  unused.sort((a, b) => {
    const aHasParent = Boolean(toId(a.parent as IdLike));
    const bHasParent = Boolean(toId(b.parent as IdLike));
    return Number(bHasParent) - Number(aHasParent);
  });

  // Report: categories currently used by tenants (IDs -> slugs)
  const usedList = Array.from(keep)
    .map((id) => byId.get(id))
    .filter((c): c is Category => Boolean(c))
    .map((c) => ({ slug: c.slug, name: c.name, id: String(c.id) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  console.log(`Tenants: ${tenants.length}`);
  console.log(`Categories total: ${categories.length}`);
  console.log(`Categories kept (used or parent-of-used): ${keep.size}`);
  console.log(`Categories UNUSED (candidates to delete): ${unused.length}`);
  console.table(usedList);

  const deleteTable = unused.map((c) => ({
    slug: c.slug,
    name: c.name,
    id: String(c.id),
    parentId: toId(c.parent as IdLike),
  }));
  console.table(deleteTable);

  if (DRY_RUN) {
    console.log(
      "DRY RUN: no deletes performed. Re-run without --dry-run to delete."
    );
    return;
  }

  for (const c of unused) {
    await payload.delete({
      collection: "categories",
      id: c.id,
      overrideAccess: true,
    });
  }

  console.log("✅ Unused categories deleted.");
}

run().catch((e) => {
  console.error("❌ categories-prune-unused failed:", e);
  process.exit(1);
});
