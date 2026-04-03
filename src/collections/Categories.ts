import { isSuperAdmin } from "../lib/access.ts";
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  PayloadRequest,
} from "payload";

type WorkType = "manual" | "consulting" | "digital";
type RelValue =
  | string
  | { id?: string | null; _id?: string | null }
  | null
  | undefined;

type CategoryDocLike = {
  id?: string;
  parent?: RelValue;
  workType?: WorkType | null;
};

type CategoryHookContext = {
  skipWorkTypeCascade?: boolean;
  inheritedWorkType?: WorkType;
};

function relId(value: RelValue): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.id === "string") return value.id;
  if (typeof value._id === "string") return value._id;
  return null;
}

function hasOwn<K extends string>(
  obj: Record<string, unknown>,
  key: K,
): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

async function loadCategory(
  req: PayloadRequest,
  id: string,
): Promise<CategoryDocLike | null> {
  const doc = await req.payload.findByID({
    collection: "categories",
    id,
    depth: 0,
    overrideAccess: true,
  });

  return (doc as CategoryDocLike | null) ?? null;
}

async function hasDirectChildren(
  req: PayloadRequest,
  id: string,
): Promise<boolean> {
  const res = await req.payload.find({
    collection: "categories",
    where: {
      parent: { equals: id },
    },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });

  return (res.docs?.length ?? 0) > 0;
}

const enforceCategoryWorkType: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  context,
}) => {
  if (!data) return data;

  const next = { ...(data as Record<string, unknown>) };
  const current = (originalDoc ?? {}) as CategoryDocLike;
  const hookContext = (context ?? {}) as CategoryHookContext;

  // Important: explicit `parent: null` must clear the parent and turn the doc
  // into a root category. Do not fall back to originalDoc in that case.
  const parentProvided = hasOwn(next, "parent");
  const nextParentId = parentProvided
    ? relId(next.parent as RelValue)
    : relId(current.parent);

  const workTypeProvided = hasOwn(next, "workType");
  const nextWorkType = (
    workTypeProvided ? next.workType : current.workType
  ) as WorkType | null | undefined;

  if (!nextParentId) {
    // Root categories own the classification for the whole category group.
    if (!nextWorkType) {
      throw new Error("Root categories must define a work type.");
    }

    return next;
  }

  if (current.id && nextParentId === current.id) {
    throw new Error("A category cannot be its own parent.");
  }

  // Internal cascade writes already carry the inherited parent value in
  // context, so avoid a second parent read that can observe stale state while
  // the outer root update is still completing.
  if (hookContext.skipWorkTypeCascade && hookContext.inheritedWorkType) {
    next.workType = hookContext.inheritedWorkType;
    return next;
  }

  const parent = await loadCategory(req, nextParentId);
  if (!parent) {
    throw new Error("Parent category not found.");
  }

  // Keep the taxonomy intentionally narrow: root -> child only.
  if (relId(parent.parent)) {
    throw new Error(
      "Subcategories can only be assigned to root categories.",
    );
  }

  // A category that already groups children cannot become a child itself.
  if (current.id && (await hasDirectChildren(req, current.id))) {
    throw new Error(
      "A category with subcategories cannot be assigned a parent.",
    );
  }

  const parentWorkType = parent.workType ?? null;
  if (!parentWorkType) {
    throw new Error(
      "Parent category must define a work type before subcategories can inherit it.",
    );
  }

  // Subcategories do not author workType independently.
  next.workType = parentWorkType;
  return next;
};

const cascadeWorkTypeToChildren: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  context,
}) => {
  const hookContext = (context ?? {}) as CategoryHookContext;

  // Loop-safety guard: cascade-triggered child updates mark their own writes so
  // they do not recursively retrigger more cascade work.
  if (hookContext.skipWorkTypeCascade) {
    return doc;
  }

  const current = doc as CategoryDocLike;
  const previous = (previousDoc ?? null) as CategoryDocLike | null;

  if (relId(current.parent)) {
    return doc;
  }

  const currentWorkType = current.workType ?? null;
  const previousWorkType = previous?.workType ?? null;

  if (!currentWorkType || currentWorkType === previousWorkType) {
    return doc;
  }

  const children = await req.payload.find({
    collection: "categories",
    where: {
      parent: { equals: String(current.id) },
    },
    limit: 200,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });

  for (const child of children.docs as CategoryDocLike[]) {
    if (!child.id || child.workType === currentWorkType) continue;

    await req.payload.update({
      collection: "categories",
      id: child.id,
      data: {
        workType: currentWorkType,
      },
      depth: 0,
      overrideAccess: true,
      context: {
        ...(hookContext as Record<string, unknown>),
        skipWorkTypeCascade: true,
        inheritedWorkType: currentWorkType,
      },
    });
  }

  return doc;
};

export const Categories: CollectionConfig = {
  slug: "categories",
  access: {
    read: () => true, // All users can read categories
    create: ({ req }) => isSuperAdmin(req.user), // Only super-admin can create categories
    update: ({ req }) => isSuperAdmin(req.user), // Only super-admin can update
    delete: ({ req }) => isSuperAdmin(req.user), // Only super-admin can delete categories
  },
  admin: {
    useAsTitle: "name", // This will enusre that category names are shown, not the IDs
    hidden: ({ user }) => !isSuperAdmin(user), // Hide from admin panel if not super-admin
  },
  hooks: {
    beforeChange: [enforceCategoryWorkType],
    afterChange: [cascadeWorkTypeToChildren],
  },
  fields: [
    {
      name: "name",
      type: "text",
      // Commit 2: schema localizes category/subcategory labels; seed backfill follows in Commit 3.
      localized: true,
      required: true,
    },
    {
      name: "slug", // URL-friendly version of the name (example: "clothing", "electronics")
      type: "text",
      required: true,
      unique: true, // Each slug must be unique (no duplicates)
      index: true, // Indexed for faster database lookup
    },
    {
      // Stage 1 foundation: taxonomy-owned classification used for future
      // category-group sorting/filtering. Root categories will define this and
      // subcategories will inherit it. Stage 2 hooks enforce that invariant.
      name: "workType",
      type: "select",
      label: "Work Type",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Consulting", value: "consulting" },
        { label: "Digital", value: "digital" },
      ],
      admin: {
        description:
          "Root categories define the work type for the whole category group. Subcategories inherit it from the parent category. This classifies the nature of the work, not the delivery mode.",
      },
    },
    {
      name: "color", // Optional field to associate a color with the category
      type: "text",
    },
    {
      name: "icon", // Optional Lucide icon name for top-level categories
      type: "text",
      required: false,
      admin: {
        description:
          "Optional lucide-react icon name (e.g. 'Car', 'Wrench'). Leave empty for subcategories.",
        condition: (_, siblingData) => !siblingData?.parent, // show only if no parent
      },
    },
    {
      name: "parent", // Reference to a "parent" category (for building category trees)
      type: "relationship", // Creates a relationship with another category
      relationTo: "categories", // It relates to the same "categories" collection
      hasMany: false, // Only one parent allowed (not multiple)
      // Only categories without a parent can be selected:
      admin: {
        condition: () => true,
      },
      filterOptions: () => {
        return {
          parent: { exists: false },
        };
      },
    },
    {
      name: "subcategories", // Links all subcategories belonging to a parent
      type: "join", // A Payload special type to join related items
      collection: "categories", // Also joins from the "categories" collection
      on: "parent", // Joins based on the "parent" field above
      hasMany: true, // A category can have many subcategories
    },
  ],
};
