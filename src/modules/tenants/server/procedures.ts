import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { Category } from "@payload-types";
import type { Sort, Where } from "payload";
import { z } from "zod";
import type { TenantsGetManyOutput } from "../types";
import { SORT_VALUES } from "@/constants";
import { calculateDistance } from "../distance-utils";
import type { TenantWithRelations } from "../types";

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
            return "+hourlyRate"; // Sort by hourly rate ascending
          case "price_high_to_low":
            return "-hourlyRate"; // Sort by hourly rate descending
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

      // Fix: Only apply maxPrice filter if it has actual value (not empty string)
      if ((input.maxPrice && input.maxPrice.trim() !== "")) {
        where.hourlyRate = {
          less_than_equal: Number(input.maxPrice),
        };
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

      console.log("Input services:", input.services);
      console.log("Where clause:", JSON.stringify(where, null, 2));

      const data = await ctx.db.find({
        collection: "tenants",
        depth: 3, // populate "categories", "subcategories" and "image" / / Depth 2- populate "user" (for coordinates)
        where,
        sort,
        limit: input.limit,
        page: input.cursor || 1, // Use cursor if provided, otherwise start from page 1
        pagination: true, // Enable pagination
      });

      console.log("Payload query results:", {
        totalDocs: data.totalDocs,
        docsLength: data.docs.length,
        sortApplied: sort,
        sortType: typeof sort,
        sortMethod: input.sort === "distance" ? "database + distance" : "database only",
        allTenants: data.docs.map(t => ({ 
          name: t.name, 
          hourlyRate: t.hourlyRate, 
          hourlyRateType: typeof t.hourlyRate 
        })),
      });

      // Calculate distances dynamically for the current user
      // Note: Price and tenure sorting are handled by the database query above
      // Only distance sorting requires additional processing after fetching
      let tenantsWithDistance = data.docs;

      // Remove manual sorting fallback - this is inefficient and incorrect
      // Price and tenure sorting should be handled by the database query above
      // The database will return results in the correct order based on the 'sort' parameter

      if (input.userLat && input.userLng) {
        tenantsWithDistance = data.docs.map((tenant) => {
          let distance = null;

          // Get tenant location from user coordinates (since tenant is based on user)
          const tenantUser = (tenant as TenantWithRelations).user;

          console.log("DEBUG TENANT USER:", {
            tenantName: tenant.name,
            tenantUser: tenantUser ? "EXISTS" : "NULL",
            coordinates: tenantUser?.coordinates || "MISSING",
          });

          if (tenantUser?.coordinates?.lat && tenantUser?.coordinates?.lng) {
            distance = calculateDistance(
              input.userLat!,
              input.userLng!,
              tenantUser.coordinates.lat,
              tenantUser.coordinates.lng
            );
          }

          return {
            ...tenant,
            distance, // This distance is specific to the current user
          };
        });

        // Only sort by distance if explicitly requested as "distance" sort
        // Price and tenure sorting should NOT be overridden by distance calculation
        if (input.sort === "distance") {
          // Filter out tenants without coordinates first to avoid unnecessary sorting
          const tenantsWithCoordinates = tenantsWithDistance.filter(
            (t) => (t as TenantWithRelations).distance !== null
          );
          const tenantsWithoutCoordinates = tenantsWithDistance.filter(
            (t) => (t as TenantWithRelations).distance === null
          );

          // Sort only tenants with coordinates by distance
          tenantsWithCoordinates.sort((a, b) => {
            const distanceA = (a as TenantWithRelations).distance!;
            const distanceB = (b as TenantWithRelations).distance!;
            return distanceA - distanceB; // Sort by distance ascending (nearest first)
          });

                  // Combine sorted tenants with coordinates + tenants without coordinates
        tenantsWithDistance = [...tenantsWithCoordinates, ...tenantsWithoutCoordinates];
        }
      }

      // NEW: Apply distance filter if enabled and maxDistance is set
      if (input.distanceFilterEnabled && input.maxDistance && input.maxDistance > 0) {
        const beforeCount = tenantsWithDistance.length;
        tenantsWithDistance = tenantsWithDistance.filter(
          (t) => (t as TenantWithRelations).distance === null || 
                  (t as TenantWithRelations).distance! <= input.maxDistance!
        );
        console.log(`Distance filter applied: ${beforeCount} → ${tenantsWithDistance.length} tenants (max: ${input.maxDistance}km)`);
      }

      // Debug: Show final order after all processing
      console.log("Final tenant order:", {
        sort: input.sort,
        finalOrder: tenantsWithDistance.map(t => ({ 
          name: t.name, 
          hourlyRate: t.hourlyRate, 
          distance: (t as TenantWithRelations).distance 
        }))
      });

      // console.log("Query results:", data.docs.length);

      // Artificial delay for development/testing:
      // await new Promise((resolve) => setTimeout(resolve, 5000));

      // Before returning - single comprehensive log
      console.log("=== TENANT QUERY SUMMARY ===", {
        input: {
          sort: input.sort,
          userCoords:
            input.userLat && input.userLng
              ? `${input.userLat}, ${input.userLng}`
              : "none",
          category: input.category,
          services: input.services?.length || 0,
          priceRange:
            input.maxPrice
              ? `${input.maxPrice}`
              : "none",
        },
        results: {
          totalTenants: tenantsWithDistance.length,
          withDistance: tenantsWithDistance.filter(
            (t) => (t as TenantWithRelations).distance !== null
          ).length,
          sortApplied:
            input.sort === "distance" || !input.sort ? "distance-based (default)" : input.sort,
        },
        sample:
          input.userLat && input.userLng
            ? tenantsWithDistance.slice(0, 2).map((t) => ({
                name: (t as TenantWithRelations).name,
                distance: (t as TenantWithRelations).distance,
                hourlyRate: (t as TenantWithRelations).hourlyRate,
              }))
            : "no coordinates provided",
      });

      return {
        ...data,
        docs: tenantsWithDistance,
      } as TenantsGetManyOutput;
    }),
});
