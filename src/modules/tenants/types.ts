import { Tenant } from "@payload-types";

export type TenantWithRelations = Tenant & {
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
    color?: string;
  }>;
  subcategories?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  image?: {
    id: string;
    url: string;
    filename: string;
  };
  user?: {
    id: string;
    coordinates?: {
      lat: number;
      lng: number;
      city?: string | null;
      countryISO?: string | null;
      countryName?: string | null;
      region?: string | null;
      postalCode?: string | null;
      street?: string | null;
      streetNumber?: string | null;
      ipDetected?: boolean;
      manuallySet?: boolean;
    };
    clerkImageUrl?: string | null; // Clerk profile image URL for fallback
    // ✅ Phase 2
    firstName?: string | null;
    lastName?: string | null;

    // ✅ fallback
    username?: string | null;
    email?: string | null;
  };
  distance?: number | null; // Distance from current user to this tenant
};

export type UserCoordinates = {
  lat: number;
  lng: number;
  city: string | null;
  countryISO: string | null; // ISO code (e.g., "DE")
  countryName: string | null; // Full country name (e.g., "Germany")
  region: string | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  ipDetected?: boolean;
  manuallySet?: boolean;
};

// New unified type for location selection
export type SelectedLocation = {
  formattedAddress: string;
  lat?: number;
  lng?: number;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string;
  countryISO?: string | null; // Store as ISO
  countryName?: string | null; // Display only
};

// Type for autocomplete predictions (client-side only)
export type PlacePrediction = {
  place_id: string;
  description: string;
  formatted_address?: string;
};

export type TenantsGetManyInput = {
  category?: string | null;
  subcategory?: string | null;
  maxPrice?: string | null;
  services?: string[] | null;
  sort?: string | null;
  userLat?: number | null;
  userLng?: number | null;
  maxDistance?: number | null;
  distanceFilterEnabled?: boolean;
  cursor?: number;
  limit?: number;
};

export type TenantsGetManyOutput = {
  docs: TenantWithRelations[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

// If helpful, you can intersect this into TenantWithRelations
// export type TenantWithVat = TenantWithRelations & VatFlags;

export type VatFlags = {
  country: string; // ISO-2
  vatRegistered: boolean;
  vatId?: string | null;
  vatIdValid?: boolean;
};
