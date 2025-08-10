import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { Category } from "@payload-types";
import type { Sort, Where } from "payload";
import { z } from "zod";
import type { TenantsGetManyOutput } from "../types";
import { sortValues } from "../hooks/search-params";
import { calculateDistance } from "../distance-utils";
import type { TenantWithRelations } from "../types";

export const tenantsRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        category: z.string().nullable().optional(),
        subcategory: z.string().nullable().optional(),
        minPrice: z.string().nullable().optional(),
        maxPrice: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        sort: z.enum(sortValues).nullable().optional(),
        userLat: z.number().nullable().optional(), // dynamic distance calculation
        userLng: z.number().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // prepare a "where" object (by default empty):
      const where: Where = {};

      let sort: Sort = "-createdAt"; // default sort by createdAt DESC

      // Add "nearest" sorting option for distance-based sorting
      if (input.sort === "nearest") {
        // We'll handle distance sorting after calculating distances
        sort = "-createdAt"; // fallback sort while we calculate distances
      }

      // TODO: revisit the sorting filters

      if (input.sort === "curated") {
        sort = "-createdAt"; // for test purpose sort by name
      }

      if (input.sort === "hot_and_new") {
        sort = "+createdAt"; // for test purpose sort ASSC
      }

      if (input.sort === "trending") {
        sort = "+createdAt"; // default sort by createdAt DESC
      }

      // Fix: Properly combine minPrice and maxPrice conditions
      if (input.minPrice || input.maxPrice) {
        where.hourlyRate = {
          ...(input.minPrice && { greater_than_equal: input.minPrice }),
          ...(input.maxPrice && { less_than_equal: input.maxPrice }),
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

      if (input.tags && input.tags.length > 0) {
        where["tags.name"] = {
          in: input.tags,
        };
      }

      console.log("Input tags:", input.tags);
      console.log("Where clause:", JSON.stringify(where, null, 2));

      const data = await ctx.db.find({
        collection: "tenants",
        depth: 3, // populate "categories", "subcategories" and "image" / / Depth 2- populate "user" (for coordinates)
        where,
        sort,
      });

      // Calculate distances dynamically for the current user
      let tenantsWithDistance = data.docs;

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

        // Sort by distance if "nearest" sort is requested
        if (input.sort === "nearest") {
          tenantsWithDistance.sort((a, b) => {
            const distanceA = (a as TenantWithRelations).distance;
            const distanceB = (b as TenantWithRelations).distance;

            // Handle cases where distance might be null
            if (!distanceA && !distanceB) return 0;
            if (!distanceA) return 1; // tenants without distance go to the end
            if (!distanceB) return -1;

            return distanceA - distanceB; // Sort by distance ascending (nearest first)
          });
        }
      }

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
          tags: input.tags?.length || 0,
          priceRange:
            input.minPrice || input.maxPrice
              ? `${input.minPrice || "0"} - ${input.maxPrice || "∞"}`
              : "none",
        },
        results: {
          totalTenants: tenantsWithDistance.length,
          withDistance: tenantsWithDistance.filter(
            (t) => (t as TenantWithRelations).distance !== null
          ).length,
          sortApplied: input.sort === "nearest" ? "distance-based" : input.sort,
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
