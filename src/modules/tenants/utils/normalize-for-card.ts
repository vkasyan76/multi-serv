import type { TenantWithRelations } from "@/modules/tenants/types";
import type { Category, Tenant, Media, User } from "@/payload-types";
import { calculateDistance } from "@/modules/tenants/distance-utils";

const round1 = (n: number) => Math.max(0, Math.round(n * 10) / 10);

type ViewerCoords = { lat: number; lng: number } | null | undefined;

// Type for the raw data returned by getOne procedure
type RawTenantData = Tenant & { image: Media | null };

// Extended User type that includes clerkImageUrl (added dynamically)
type ExtendedUser = User & {
  clerkImageUrl?: string | null;
};

/** Normalize raw getOne result into the shape TenantCard expects. */
export function normalizeForCard(raw: RawTenantData, viewerCoords?: ViewerCoords): TenantWithRelations {
  // image -> { id, url, filename } | undefined
  const image = raw?.image
    ? typeof raw.image === "string"
      ? { id: raw.image, url: "", filename: "" }
      : {
          id: raw.image.id,
          url: raw.image.url ?? "",
          filename: raw.image.filename ?? "",
        }
    : undefined;

  // user -> { id, coordinates?, clerkImageUrl? } | undefined
  const user =
    typeof raw?.user === "string"
      ? { id: raw.user }
      : raw?.user
      ? {
          id: (raw.user as ExtendedUser).id,
          coordinates: (raw.user as ExtendedUser).coordinates,
          clerkImageUrl: (raw.user as ExtendedUser).clerkImageUrl ?? null,
        }
      : undefined;

  // categories / subcategories -> arrays of objects (no nulls)
  const categories =
    raw?.categories
      ?.filter(Boolean)
      ?.map((c: string | Category) =>
        typeof c === "string"
          ? { id: c, name: "", slug: "" }
          : { id: c.id, name: c.name, slug: c.slug, color: c.color }
      ) ?? undefined;

  const subcategories =
    raw?.subcategories
      ?.filter(Boolean)
      ?.map((s: string | Category) =>
        typeof s === "string"
          ? { id: s, name: "", slug: "" }
          : { id: s.id, name: s.name, slug: s.slug }
      ) ?? undefined;

  // distance (only if both sides have coords)
  let distance: number | null = null;
  if (
    viewerCoords &&
    user?.coordinates?.lat != null &&
    user?.coordinates?.lng != null
  ) {
    const rawDistance = calculateDistance(
      viewerCoords.lat,
      viewerCoords.lng,
      user.coordinates.lat,
      user.coordinates.lng
    );
    distance = round1(rawDistance);
  }

  return {
    ...raw,
    image,
    user,
    categories,
    subcategories,
    distance,
  } as TenantWithRelations;
}
