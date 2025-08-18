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
    };
    clerkImageUrl?: string | null; // Clerk profile image URL for fallback
  };
  distance?: number | null; // Distance from current user to this tenant
};

export type UserCoordinates = {
  lat: number;
  lng: number;
  city?: string;
  country?: string; // ISO code (e.g., "DE")
  region?: string;
  postalCode?: string;
  street?: string;
  ipDetected?: boolean;
  manuallySet?: boolean;
};

// New unified type for location selection
export type SelectedLocation = {
  formattedAddress: string;
  lat?: number;
  lng?: number;
  city?: string;
  region?: string;
  postalCode?: string;
  street?: string;
  countryISO?: string;    // Store as ISO
  countryName?: string;   // Display only
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
