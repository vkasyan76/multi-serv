// src/scripts/categories.ts
process.env.PAYLOAD_DISABLE_AUTH_FOR_SCRIPTS = "true";

import "dotenv/config";
import { getPayload, type Payload } from "payload";
import config from "../payload.config.js";

const NEW_ONLY = process.argv.includes("--new-only");

type Cat = {
  name: string;
  slug: string;
  color?: string;
  icon?: string; // Lucide icon name for the category
  subcategories?: Array<{ name: string; slug: string }>;
};

const MANUAL_CATEGORIES: Cat[] = [
  {
    name: "Auto Repair",
    slug: "auto-repair",
    color: "#374151",
    icon: "lucide:car",
    subcategories: [
      { name: "Vehicle Diagnostics", slug: "vehicle-diagnostics" },
      { name: "Brake Service", slug: "brake-service" },
      { name: "Oil Change", slug: "oil-change" },
      { name: "Tires & Wheels", slug: "tires-wheels" },
      { name: "Electrical & Battery", slug: "auto-electrical" },
    ],
  },
  {
    name: "Plumbing",
    slug: "plumbing",
    color: "#2563eb",
    icon: "lucide:wrench",
    subcategories: [
      { name: "Leak Repair", slug: "leak-repair" },
      { name: "Pipe Installation", slug: "pipe-installation" },
      { name: "Drain Cleaning", slug: "drain-cleaning" },
      { name: "Water Heater Service", slug: "water-heater-service" },
      { name: "Fixtures (Bath/Kitchen)", slug: "fixtures-installation" },
    ],
  },
  {
    name: "Bricklaying & Masonry",
    slug: "bricklaying-masonry",
    color: "#d97706",
    icon: "lucide:brick-wall",
    subcategories: [
      { name: "Masonry Repair", slug: "masonry-repair" },
      { name: "Paving & Walkways", slug: "paving-walkways" },
      { name: "Chimney Work", slug: "chimney-work" },
      { name: "Retaining Walls", slug: "retaining-walls" },
      { name: "Stonework", slug: "stonework" },
    ],
  },
  {
    name: "Roofing",
    slug: "roofing",
    color: "#6b7280",
    icon: "fa6-solid:house-chimney",
    subcategories: [
      { name: "Roof Repair", slug: "roof-repair" },
      { name: "New Roof Installation", slug: "new-roof-installation" },
      { name: "Gutter Installation", slug: "gutter-installation" },
      { name: "Roof Inspection", slug: "roof-inspection" },
      { name: "Solar System Installer", slug: "solar-system-installer" },
    ],
  },
  {
    name: "Furniture Assembly",
    slug: "furniture-assembly",
    color: "#10b981",
    icon: "lucide:armchair",
    subcategories: [
      { name: "Flat-pack / IKEA", slug: "flatpack-assembly" },
      { name: "Office Furniture", slug: "office-furniture-assembly" },
      { name: "Bed & Wardrobe", slug: "bed-wardrobe-assembly" },
      { name: "Outdoor Furniture", slug: "outdoor-furniture-assembly" },
      { name: "Mounting & Disassembly", slug: "mounting-disassembly" },
    ],
  },
  {
    name: "Relocation",
    slug: "relocation",
    color: "#0ea5e9",
    icon: "lucide:truck",
    subcategories: [
      { name: "Local Moving", slug: "local-moving" },
      { name: "Long-Distance Moving", slug: "long-distance-moving" },
      { name: "Packing & Unpacking", slug: "packing-unpacking" },
      {
        name: "Furniture Disassembly/Assembly",
        slug: "moving-furniture-assembly",
      },
      { name: "Van/Truck with Driver", slug: "man-and-van" },
    ],
  },
  {
    name: "Cleaning",
    slug: "cleaning",
    color: "#a855f7",
    icon: "mdi:broom",
    subcategories: [
      { name: "Regular Home Cleaning", slug: "home-cleaning" },
      { name: "Deep Cleaning", slug: "deep-cleaning" },
      { name: "Move-Out / End-of-Lease", slug: "end-of-lease-cleaning" },
      { name: "Office / Commercial", slug: "office-cleaning" },
      { name: "Carpet & Upholstery", slug: "carpet-upholstery-cleaning" },
    ],
  },
  {
    name: "Gardening",
    slug: "gardening",
    color: "#16a34a",
    icon: "lucide:trees",
    subcategories: [
      { name: "Lawn Mowing", slug: "lawn-mowing" },
      { name: "Hedge & Tree Trimming", slug: "hedge-tree-trimming" },
      { name: "Planting & Bed Setup", slug: "planting-bed-setup" },
      { name: "Weeding & Cleanup", slug: "garden-cleanup" },
      { name: "Irrigation Setup", slug: "irrigation-setup" },
    ],
  },
];

type UpsertResult = { id: string; action: "created" | "updated" | "skipped" };

// Create or update by slug (idempotent). No deletes.
async function upsertCategory(
  payload: Payload,
  data: {
    name: string;
    slug: string;
    color?: string;
    icon?: string;
    parent?: string | null;
  }
): Promise<UpsertResult> {
  const existing = await payload.find({
    collection: "categories",
    where: { slug: { equals: data.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  if (existing.totalDocs > 0) {
    const doc = existing.docs[0]! as {
      id: string;
      name?: string;
      color?: string | null;
      icon?: string | null;
      parent?: string | { id?: string } | null;
    };

    if (NEW_ONLY) return { id: String(doc.id), action: "skipped" };

    const patch: Record<string, unknown> = {};
    if (doc.name !== data.name) patch.name = data.name;
    if ((doc.color ?? null) !== (data.color ?? null))
      patch.color = data.color ?? null;

    if ((doc.icon ?? null) !== (data.icon ?? null))
      patch.icon = data.icon ?? null;

    // parent can be string or populated object; compare as strings
    const currentParentId =
      (typeof doc.parent === "object" && doc.parent && "id" in doc.parent
        ? doc.parent.id
        : typeof doc.parent === "string"
          ? doc.parent
          : null) ?? null;

    if (String(currentParentId ?? "") !== String(data.parent ?? "")) {
      patch.parent = data.parent ?? null;
    }

    if (Object.keys(patch).length > 0) {
      const updated = await payload.update({
        collection: "categories",
        id: doc.id,
        data: patch,
        overrideAccess: true,
      });
      return { id: String(updated.id), action: "updated" };
    }
    return { id: String(doc.id), action: "skipped" };
  }

  const created = await payload.create({
    collection: "categories",
    data: {
      name: data.name,
      slug: data.slug,
      color: data.color,
      icon: data.icon ?? null,
      parent: data.parent ?? null,
    },
    overrideAccess: true,
  });
  return { id: String(created.id), action: "created" };
}

async function run() {
  const payload = await getPayload({ config });

  const summary: Array<{ slug: string; action: UpsertResult["action"] }> = [];

  for (const cat of MANUAL_CATEGORIES) {
    const parent = await upsertCategory(payload, {
      name: cat.name,
      slug: cat.slug,
      color: cat.color,
      icon: cat.icon,
      parent: null,
    });
    summary.push({ slug: cat.slug, action: parent.action });

    for (const sub of cat.subcategories ?? []) {
      const subRes = await upsertCategory(payload, {
        name: sub.name,
        slug: sub.slug, // slugs are unique globally in your schema
        parent: parent.id,
      });
      summary.push({ slug: sub.slug, action: subRes.action });
    }
  }

  console.table(summary);
}

run()
  .then(() => {
    console.log("Category upsert completed.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Category upsert failed:", e);
    process.exit(1);
  });
