import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { Category, Media, Tenant } from "@payload-types";
import type { Sort, Where } from "payload";
import { z } from "zod";
import type { TenantsGetManyOutput } from "../types";
import { SORT_VALUES } from "@/constants";
import { calculateDistance } from "../distance-utils";
import type { TenantWithRelations } from "../types";
import { TRPCError } from "@trpc/server";

// Helper interface for tenant user data
interface TenantUserData {
  id: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  clerkImageUrl?: string | null;
}

export const tenantsRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        category: z.string().nullable().optional(),
        subcategory: z.string().nullable().optional(),
        maxPrice: z.string().nullable().optional(),
        services: z.array(z.string()).nullable().optional(),
        sort: z.enum(SORT_VALUES).nullable().optional(),
        userLat: z.number().nullable().optional(), // dynamic distance calculation
        userLng: z.number().nullable().optional(),
        maxDistance: z.number().min(0).max(300).nullable().optional(), // NEW
        distanceFilterEnabled: z.boolean().default(false), // NEW
        cursor: z.number().optional(), // Optional cursor for infinite queries
        limit: z.number().min(1).max(100).default(20), // Page size
      })
    )
    .query(async ({ ctx, input }) => {
      // prepare a "where" object (by default empty):
      const where: Where = {};

      // Map new sort values to Payload sort syntax
      const mapSortToPayloadFormat = (sort?: string | null): Sort => {
        switch (sort) {
          case "price_low_to_high":
            return "hourlyRate"; // Sort by hourly rate ascending (low to high)
          case "price_high_to_low":
            return "-hourlyRate"; // Sort by hourly rate descending (high to low)
          case "tenure_newest":
            return "-createdAt"; // Newest tenants first
          case "tenure_oldest":
            return "+createdAt"; // Oldest tenants first
          case "distance":
          default:
            return "-createdAt"; // Default to distance sorting (nearest first)
        }
      };

      const sort: Sort = mapSortToPayloadFormat(input.sort);

      // --- derive viewer coords on the SERVER (prefer bridged ctx.userId) ---
      let viewerCoords: { lat: number; lng: number } | null = null;

      if (ctx.userId) {
        const viewer = await ctx.db
          .find({
            collection: "users",
            where: { clerkUserId: { equals: ctx.userId } },
            limit: 1,
            depth: 0,
          })
          .then((r) => r.docs[0]);

        const c = viewer?.coordinates;
        if (typeof c?.lat === "number" && typeof c?.lng === "number") {
          viewerCoords = { lat: c.lat, lng: c.lng };
        }
      }

      // If the client provided coords, use them only if server coords are missing
      if (!viewerCoords && input.userLat && input.userLng) {
        viewerCoords = { lat: input.userLat, lng: input.userLng };
      }

      // Apply maxPrice filter if it has actual value (not empty string)
      if (input.maxPrice && input.maxPrice.trim() !== "") {
        const maxPriceValue = Number(input.maxPrice);
        if (!isNaN(maxPriceValue) && maxPriceValue > 0) {
          where.hourlyRate = {
            less_than_equal: maxPriceValue,
          };
        }
      }

      if (input.category) {
        // Fetch category data to validate the category exists and get its subcategories
        const categoriesData = await ctx.db.find({
          collection: "categories",
          limit: 1,
          depth: 1, // Populate subcategories, subcategories.[0] is type "Category"
          pagination: false,
          where: {
            slug: {
              equals: input.category,
            },
          },
        });

        // console.log(JSON.stringify(categoriesData, null, 2));

        const formattedData = categoriesData.docs.map((doc) => ({
          ...doc,
          subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
            // Populate subcategories, subcategories.[0] will be a type of "Category"
            ...(doc as Category),
            subcategories: undefined,
          })),
        }));

        // prepare subcategories:
        const subcategoriesSlugs = [];

        // 1st in the array:
        const parentCategory = formattedData[0];

        // NESTED LOGIC: Only apply filtering if the category exists
        // This prevents crashes when invalid categories (like "favicon.ico") are passed
        if (parentCategory) {
          subcategoriesSlugs.push(
            ...parentCategory.subcategories.map(
              (subcategory) => subcategory.slug
            )
          );

          // SUB-CATEGORY FILTERING: Check if we're filtering by a specific subcategory
          if (input.subcategory) {
            // Filter tenants that belong to this specific subcategory
            where["subcategories.slug"] = {
              equals: input.subcategory,
            };
          } else {
            // CATEGORY FILTERING: Filter tenants that belong to this category OR any of its subcategories
            where["categories.slug"] = {
              in: [parentCategory.slug, ...subcategoriesSlugs],
            };
          }
        }
      }

      if (input.services && input.services.length > 0) {
        where.services = {
          in: input.services,
        };
      }

      // For price sorting, we need to filter out tenants with undefined hourly rates
      // as they can't be properly sorted by price
      if (
        input.sort === "price_low_to_high" ||
        input.sort === "price_high_to_low"
      ) {
        // Preserve existing price filters and add sorting requirements
        const existingPriceFilter = where.hourlyRate || {};
        where.hourlyRate = {
          ...existingPriceFilter,
          exists: true, // Ensure hourlyRate field exists
          not_equals: null, // Also exclude null values
        };
      }

      const data = await ctx.db.find({
        collection: "tenants",
        depth: 3, // populate "categories", "subcategories" and "image" / / Depth 2- populate "user" (for coordinates)
        where,
        sort,
        limit: input.limit,
        page: input.cursor || 1, // Use cursor if provided, otherwise start from page 1
        pagination: true, // Enable pagination
      });

      // Calculate distances dynamically for the current user
      // Note: Price and tenure sorting are handled by the database query above
      // Only distance sorting requires additional processing after fetching
      let tenantsWithDistance = data.docs;

      // FALLBACK: If distance sorting requested but we don't have viewer coords yet
      if (input.sort === "distance" && !viewerCoords) {
        console.log(
          "Anonymous/unknown viewer requested distance sorting → falling back to price_low_to_high"
        );
        const priceSortedData = await ctx.db.find({
          collection: "tenants",
          depth: 3,
          where,
          sort: "hourlyRate", // low → high
          limit: input.limit,
          page: input.cursor || 1,
          pagination: true,
        });
        Object.assign(data, priceSortedData);
        tenantsWithDistance = data.docs;
      } else if (input.sort === "distance" && viewerCoords) {
        console.log(
          `${ctx.authSource ?? "unknown"} user requested distance sorting → using distance calculation`
        );
      }

      // Note: Price sorting is now handled by database query with proper filtering

      if (viewerCoords) {
        // Preserve the database sort order by mapping in the same order
        tenantsWithDistance = data.docs.map((tenant) => {
          let distance: number | null = null;

          const tenantUser = (tenant as TenantWithRelations).user;

          if (
            typeof tenantUser?.coordinates?.lat === "number" &&
            typeof tenantUser?.coordinates?.lng === "number" &&
            Number.isFinite(tenantUser.coordinates.lat) &&
            Number.isFinite(tenantUser.coordinates.lng)
          ) {
            distance = calculateDistance(
              viewerCoords!.lat,
              viewerCoords!.lng,
              tenantUser.coordinates.lat,
              tenantUser.coordinates.lng
            );
          }

          const userData: TenantUserData | undefined =
            tenantUser && typeof tenantUser === "object"
              ? {
                  id: tenantUser.id || "",
                  coordinates: tenantUser.coordinates || undefined,
                  clerkImageUrl:
                    (tenantUser as TenantUserData)?.clerkImageUrl || null,
                }
              : undefined;

          return {
            ...tenant,
            distance, // now computed from viewerCoords
            user: userData,
          } as TenantWithRelations;
        });

        // Only sort by distance if explicitly requested
        if (input.sort === "distance") {
          const tenantsWithCoordinates = tenantsWithDistance.filter(
            (t) => (t as TenantWithRelations).distance !== null
          );
          const tenantsWithoutCoordinates = tenantsWithDistance.filter(
            (t) => (t as TenantWithRelations).distance === null
          );

          tenantsWithCoordinates.sort((a, b) => {
            const distanceA = (a as TenantWithRelations).distance!;
            const distanceB = (b as TenantWithRelations).distance!;
            return distanceA - distanceB;
          });

          tenantsWithDistance = [
            ...tenantsWithCoordinates,
            ...tenantsWithoutCoordinates,
          ];
        }
      }

      // NEW: Apply distance filter if enabled and maxDistance is set
      if (
        input.distanceFilterEnabled &&
        input.maxDistance &&
        input.maxDistance > 0
      ) {
        const beforeCount = tenantsWithDistance.length;
        tenantsWithDistance = tenantsWithDistance.filter(
          (t) =>
            (t as TenantWithRelations).distance === null ||
            (t as TenantWithRelations).distance! <= input.maxDistance!
        );
        console.log(
          `Distance filter applied: ${beforeCount} → ${tenantsWithDistance.length} tenants (max: ${input.maxDistance}km)`
        );
      }

      // console.log("Query results:", data.docs.length);

      // Artificial delay for development/testing:
      // await new Promise((resolve) => setTimeout(resolve, 5000));

      return {
        ...data,
        docs: tenantsWithDistance, // Keep the distance-calculated tenants but respect pagination
        // Ensure proper pagination metadata for infinite queries
        hasNextPage: data.hasNextPage,
        nextPage: data.hasNextPage ? data.nextPage : undefined,
        hasPrevPage: data.hasPrevPage,
        prevPage: data.hasPrevPage ? data.prevPage : undefined,
        totalDocs: data.totalDocs,
        totalPages: data.totalPages,
        page: data.page,
        limit: data.limit,
        pagingCounter: data.pagingCounter,
      } as TenantsGetManyOutput;
    }),

  getOne: baseProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // set-up for pagination:
      const tenantsData = await ctx.db.find({
        collection: "tenants",
        depth: 3, // populate "categories", "subcategories", "image", and "user" with coordinates
        where: {
          slug: {
            equals: input.slug,
          },
        },
        limit: 1,
        pagination: false,
      });

      const tenant = tenantsData.docs[0];

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      return tenant as Tenant & { image: Media | null };
    }),

  getOneForCard: baseProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // 1) Load tenant (same as getOne)
      const tenantsData = await ctx.db.find({
        collection: "tenants",
        depth: 3, // populate "categories", "subcategories", "image", and "user" with coordinates
        where: {
          slug: {
            equals: input.slug,
          },
        },
        limit: 1,
        pagination: false,
      });

      const tenant = tenantsData.docs[0];

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      // 2) Derive viewerCoords on the SERVER using bridged ctx.userId
      let viewerCoords: { lat: number; lng: number } | null = null;

      if (ctx.userId) {
        const viewer = await ctx.db
          .find({
            collection: "users",
            where: { clerkUserId: { equals: ctx.userId } },
            limit: 1,
          })
          .then((r) => r.docs[0]);

        const c = viewer?.coordinates;
        if (typeof c?.lat === "number" && typeof c?.lng === "number") {
          viewerCoords = { lat: c.lat, lng: c.lng };
        }
      }

      // 3) Import and use normalizeForCard on the server (this computes distance)
      const { normalizeForCard } = await import("../utils/normalize-for-card");
      return normalizeForCard(
        tenant as Tenant & { image: Media | null },
        viewerCoords
      );
    }),

  // getMine: baseProcedure
  //   .input(z.object({})) // no input
  //   .query(async ({ ctx }) => {
  //     const userId = ctx.auth?.userId;
  //     if (!userId) {
  //       throw new TRPCError({ code: "UNAUTHORIZED" });
  //     }

  //     // Use ctx.db (which is the payload instance) instead of importing payload
  //     const res = await ctx.db.find({
  //       collection: "tenants",
  //       where: {
  //         user: { equals: userId }, // Based on your Tenant collection structure
  //       },
  //       limit: 1,
  //     });

  //     return res.docs[0] ?? null;
  //   }),
  getMine: baseProcedure.input(z.object({})).query(async ({ ctx }) => {
    const clerkUserId = ctx.userId; // "user_…"
    if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

    // Clerk -> Payload user id
    const me = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: clerkUserId } },
      limit: 1,
      depth: 0,
    });
    const payloadUserId = me.docs[0]?.id;
    if (!payloadUserId) return null;

    // Payload user -> tenant
    const t = await ctx.db.find({
      collection: "tenants",
      where: { user: { equals: payloadUserId } },
      sort: "-createdAt",
      limit: 1,
      depth: 0,
    });
    return t.docs[0] ?? null;
  }),
});
