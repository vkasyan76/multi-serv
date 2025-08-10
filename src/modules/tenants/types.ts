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
  };
  distance?: number | null; // Distance from current user to this tenant
};

export type UserCoordinates = {
  lat: number;
  lng: number;
};

export type TenantsGetManyInput = {
  category?: string | null;
  subcategory?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  tags?: string[] | null;
  sort?: string | null;
  userLat?: number | null;
  userLng?: number | null;
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
