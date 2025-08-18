import { headers as getHeaders, cookies as getCookies } from "next/headers";
import { baseProcedure, createTRPCRouter, clerkProcedure } from "@/trpc/init";
// import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AUTH_COOKIE } from "../constants";
import { registerSchema, loginSchema } from "../schemas";
import { generateAuthCookie } from "../utils";
import { stripe } from "@/lib/stripe";
import { updateClerkUserMetadata } from "@/lib/auth/updateClerkMetadata";
import { vendorSchema, profileSchema } from "@/modules/profile/schemas";
import { z } from "zod";
import type { UserCoordinates } from "@/modules/tenants/types";
import {
  hasValidCoordinates,
} from "@/modules/profile/location-utils";

// Consistent ID masking helper for PII protection
const mask = (v: unknown) => `${String(v ?? "").slice(0, 8)}…`;

export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    const headers = await getHeaders();

    const session = await ctx.db.auth({
      headers,
    });

    return session;
  }),

  // logout procedure:  - can be deleted - because we'll neber be using it like this.
  logout: baseProcedure.mutation(async () => {
    const cookies = await getCookies();

    // remove cookie:
    cookies.delete(AUTH_COOKIE);
    // suggested by ChatGPT: return sucess - front-end can await trpc.auth.logout.mutate() and know for sure that the server has actually cleared the cookie before proceeding:
    return { success: true };
  }),

  // register procedure:
  register: baseProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      // find if the name was already used:
      const existingData = await ctx.db.find({
        collection: "users",
        limit: 1,
        where: {
          username: {
            equals: input.username,
          },
        },
      });

      const existingUser = existingData.docs[0];

      if (existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Username already taken",
        });
      }

      // Create user only - NO tenant or Stripe account initially
      await ctx.db.create({
        collection: "users",
        data: {
          email: input.email,
          username: input.username,
          // No tenants array initially - will be added when user becomes vendor
        },
      });

      // Login the user and set the cookie
      const data = await ctx.db.login({
        collection: "users",
        data: {
          email: input.email,
          password: input.password,
        },
      });
      if (!data.token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }
      await generateAuthCookie({
        prefix: ctx.db.config.cookiePrefix,
        value: data.token,
      });
      return data;
    }),
  // Login Procedure:
  login: baseProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const data = await ctx.db.login({
      collection: "users",
      data: {
        email: input.email,
        password: input.password,
      },
    });
    if (!data.token) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }
    await generateAuthCookie({
      prefix: ctx.db.config.cookiePrefix,
      value: data.token,
    });
    return data;
  }),

  // Clerk session procedure: clerkSession only fetches a record; it never creates one. This causes the “no record created” behavior.
  clerkSession: clerkProcedure.query(async ({ ctx }) => {
    // Now you have ctx.db (payload instance) and ctx.auth (if present in your context)
    const userId = ctx.auth?.userId;
    if (!userId) return null;

    // Use ctx.db (no need to call getPayload again)
    const users = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: userId } },
    });

    if (users.totalDocs === 0) return null;

    const user = users.docs[0];
    if (!user) return null;
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        clerkUserId: user.clerkUserId,
      },
    };
  }),

  // Introduce a server‑side handler (via tRPC mutation or Clerk webhook) that creates the user in Payload on first Clerk sign‑in.
  // If a user exists but has no tenant, create a Stripe account and new tenant, then update the user. If tenant is already present, return as-is.
  // Call updateClerkUserMetadata to ensure Clerk user metadata is in sync with Payload user data.

  syncClerkUser: clerkProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.userId;

    const existing = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: userId } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      const existingUser = existing.docs[0];
      if (!existingUser) return null;

      // Don't auto-create tenant - let user decide when to become vendor
      // Optional: Keep Clerk in sync if needed
      if (
        typeof existingUser.username === "string" &&
        existingUser.username.length > 0
      ) {
        await updateClerkUserMetadata(
          userId!,
          existingUser.id as string,
          existingUser.username // now narrowed to `string`
        );
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "syncClerkUser: username is null/empty; skipping Clerk metadata update"
          );
        }
      }
      return existingUser;
    }

    // New user flow - webhook should have created this user
    // If we get here, it means webhook hasn't run yet (rare case)
    console.log("tRPC - User not found, webhook may not have run yet");

    // Return null to indicate user needs to be created by webhook
    // The frontend can handle this gracefully
    return null;
  }),

  createVendorProfile: clerkProcedure
    .input(vendorSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // Find the user
      const user = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: userId } },
        limit: 1,
      });

      if (user.totalDocs === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const currentUser = user.docs[0];

      // Check if user already has a tenant (vendor profile)
      if (
        currentUser &&
        currentUser.tenants &&
        currentUser.tenants.length > 0
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User already has a vendor profile",
        });
      }

      // Check if business name is already taken by another vendor
      const existingTenant = await ctx.db.find({
        collection: "tenants",
        where: { name: { equals: input.name } },
        limit: 1,
      });

      if (existingTenant.totalDocs > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Business name is already taken. Please choose a different name.",
        });
      }

      // Convert category slugs to ObjectIds
      let categoryIds: string[] = [];
      if (input.categories && input.categories.length > 0) {
        const categoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.categories },
          },
          limit: 100,
        });
        categoryIds = categoryDocs.docs.map((doc) => doc.id);
      }

      // Convert subcategory slugs to ObjectIds
      let subcategoryIds: string[] = [];
      if (input.subcategories && input.subcategories.length > 0) {
        const subcategoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.subcategories },
          },
          limit: 100,
        });
        subcategoryIds = subcategoryDocs.docs.map((doc) => doc.id);
      }

      let account: { id?: string } | null = null;
      let tenant: { id: string } | null = null;

      try {
        // Create Stripe account for the vendor
        account = await stripe.accounts.create();

        if (!account.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Stripe account",
          });
        }

        // Create tenant with vendor profile data
        tenant = await ctx.db.create({
          collection: "tenants",
          data: {
            name: input.name || currentUser?.username || "",
            slug: input.name || currentUser?.username || "", // Use business name as slug for routing
            stripeAccountId: account.id,
            firstName: input.firstName,
            lastName: input.lastName,
            bio: input.bio,
            services: input.services,
            categories: categoryIds,
            subcategories: subcategoryIds,
            website: input.website,
            image: input.image,
            phone: input.phone,
            hourlyRate: input.hourlyRate,
            user: currentUser!.id,
          },
        });

        // Link tenant to user
        if (!currentUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        await ctx.db.update({
          collection: "users",
          id: currentUser.id,
          data: {
            tenants: [{ tenant: tenant.id }],
          },
        });

        return tenant;
      } catch (error) {
        // Check if error is due to duplicate business name constraint
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("duplicate") ||
          errorMessage.includes("unique") ||
          errorMessage.includes("already exists")
        ) {
          // Cleanup Stripe account if it was created
          if (account?.id) {
            await stripe.accounts.del(account.id).catch(console.error);
          }
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Business name is already taken. Please choose a different name.",
          });
        }

        // Cleanup Stripe account if it was created but database operations failed
        if (account?.id) {
          await stripe.accounts.del(account.id).catch(console.error);
        }
        throw error;
      }
    }),

  updateVendorProfile: clerkProcedure
    .input(vendorSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // Find the user
      const user = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: userId } },
        limit: 1,
      });

      if (user.totalDocs === 0) {
        throw new Error("User not found");
      }

      const currentUser = user.docs[0];

      // Find the user's tenant
      if (
        !currentUser ||
        !currentUser.tenants ||
        currentUser.tenants.length === 0
      ) {
        throw new Error("No tenant found for user");
      }

      const tenantObj = currentUser.tenants[0];
      const tenantId = tenantObj ? tenantObj.tenant : undefined;

      // Ensure we have the correct tenant ID
      const actualTenantId =
        typeof tenantId === "object" ? tenantId.id : tenantId;

      // Check if business name is already taken by another vendor (excluding current user's tenant)
      const existingTenant = await ctx.db.find({
        collection: "tenants",
        where: {
          and: [
            { name: { equals: input.name } },
            { id: { not_equals: actualTenantId } },
          ],
        },
        limit: 1,
      });

      if (existingTenant.totalDocs > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Business name is already taken. Please choose a different name.",
        });
      }

      // Convert category slugs to ObjectIds
      let categoryIds: string[] = [];
      if (input.categories && input.categories.length > 0) {
        const categoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.categories },
          },
          limit: 100,
        });
        categoryIds = categoryDocs.docs.map((doc) => doc.id);
      }

      // Convert subcategory slugs to ObjectIds
      let subcategoryIds: string[] = [];
      if (input.subcategories && input.subcategories.length > 0) {
        const subcategoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.subcategories },
          },
          limit: 100,
        });
        subcategoryIds = subcategoryDocs.docs.map((doc) => doc.id);
      }

      try {
        // Update the tenant with vendor profile data
        const updatedTenant = await ctx.db.update({
          collection: "tenants",
          id: actualTenantId as string,
          data: {
            name: input.name,
            slug: input.name, // Update slug to match new business name
            firstName: input.firstName,
            lastName: input.lastName,
            bio: input.bio,
            services: input.services,
            categories: categoryIds, // Array of category ObjectIds
            subcategories: subcategoryIds, // Array of subcategory ObjectIds
            website: input.website,
            image: input.image || undefined, // Pass the file ID for the relationship
            phone: input.phone,
            hourlyRate: input.hourlyRate, // This will be a number after schema transformation
          },
        });

        return updatedTenant;
      } catch (error) {
        // Check if error is due to duplicate business name constraint
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("duplicate") ||
          errorMessage.includes("unique") ||
          errorMessage.includes("already exists")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Business name is already taken. Please choose a different name.",
          });
        }
        throw error;
      }
    }),

  // Check business name availability
  checkBusinessNameAvailability: clerkProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // Find the user
      const user = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: userId } },
        limit: 1,
      });

      if (user.totalDocs === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const currentUser = user.docs[0];
      let currentTenantId: string | null = null;

      // Get current user's tenant ID if they have one
      if (
        currentUser &&
        currentUser.tenants &&
        currentUser.tenants.length > 0
      ) {
        const tenantObj = currentUser.tenants[0];
        if (tenantObj) {
          const tenantId = tenantObj.tenant;
          currentTenantId =
            typeof tenantId === "object" ? tenantId.id : tenantId;
        }
      }

      // Check if business name is already taken
      const existingTenant = await ctx.db.find({
        collection: "tenants",
        where: {
          and: [
            { name: { equals: input.name.toLowerCase() } },
            ...(currentTenantId
              ? [{ id: { not_equals: currentTenantId } }]
              : []),
          ],
        },
        limit: 1,
      });

      return {
        available: existingTenant.totalDocs === 0,
        message:
          existingTenant.totalDocs > 0
            ? "Business name is already taken"
            : "Business name is available",
      };
    }),

  getUserProfile: clerkProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;

    // Find the user
    const user = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: userId } },
      limit: 1,
    });

    if (user.totalDocs === 0) {
      // Return null instead of throwing - this stops the infinite spinner
      console.log(
        "getUserProfile: No user found for clerkUserId:",
        mask(userId)
      );
      return null;
    }

    const currentUser = user.docs[0];

    if (!currentUser) {
      // Return null instead of throwing - this stops the infinite spinner
      console.log(
        "getUserProfile: User document is null for clerkUserId:",
        mask(userId)
      );
      return null;
    }

    return {
      username: currentUser.username,
      email: currentUser.email,
      location: currentUser.location || "",
      country: currentUser.country || "",
      language: currentUser.language || "en",
      coordinates: hasValidCoordinates(currentUser.coordinates)
        ? {
            lat: currentUser.coordinates.lat,
            lng: currentUser.coordinates.lng,
            city: (currentUser.coordinates as UserCoordinates).city,
            country: (currentUser.coordinates as UserCoordinates).country,
            region: (currentUser.coordinates as UserCoordinates).region,
            postalCode: (currentUser.coordinates as UserCoordinates).postalCode,
            street: (currentUser.coordinates as UserCoordinates).street,
            ipDetected: (currentUser.coordinates as UserCoordinates).ipDetected,
            manuallySet: (currentUser.coordinates as UserCoordinates)
              .manuallySet,
          }
        : undefined,
      onboardingCompleted: currentUser.onboardingCompleted || false,
    };
  }),

  getVendorProfile: clerkProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.userId;
      // Find the user
      const user = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: userId } },
        limit: 1,
      });

      if (user.totalDocs === 0) {
        throw new Error("User not found");
      }

      const currentUser = user.docs[0];

      if (!currentUser) {
        throw new Error("User not found");
      }

      // Find the tenant through the user's tenant relationship
      if (!currentUser.tenants || currentUser.tenants.length === 0) {
        return null; // No tenant associated with user
      }

      const tenantObj = currentUser.tenants[0];
      if (!tenantObj) {
        return null; // No tenant associated with user
      }

      const tenantId = tenantObj.tenant;
      const actualTenantId =
        typeof tenantId === "object" ? tenantId.id : tenantId;

      // Get the tenant by ID with populated image field
      const tenant = await ctx.db.findByID({
        collection: "tenants",
        id: actualTenantId,
        depth: 1, // This will populate the image relationship
      });

      if (!tenant) {
        return null; // No vendor profile exists yet
      }

      // Convert category ObjectIds to slugs
      let categorySlugs: string[] = [];
      if (tenant.categories && tenant.categories.length > 0) {
        // Extract just the IDs from the category objects
        const categoryIds = tenant.categories.map((cat) =>
          typeof cat === "object" && cat.id ? cat.id : cat
        );

        const categoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            id: { in: categoryIds },
          },
          limit: 100,
        });
        categorySlugs = categoryDocs.docs.map((doc) => doc.slug);
      }

      // Convert subcategory ObjectIds to slugs
      let subcategorySlugs: string[] = [];
      if (tenant.subcategories && tenant.subcategories.length > 0) {
        // Extract just the IDs from the subcategory objects
        const subcategoryIds = tenant.subcategories.map((sub) =>
          typeof sub === "object" && sub.id ? sub.id : sub
        );

        const subcategoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            id: { in: subcategoryIds },
          },
          limit: 100,
        });
        subcategorySlugs = subcategoryDocs.docs.map((doc) => doc.slug);
      }

      const result = {
        id: actualTenantId, // ✅ ADD THIS: Include tenant ID for image uploads
        name: tenant.name || "",
        firstName: tenant.firstName || "",
        lastName: tenant.lastName || "",
        bio: tenant.bio || "",
        services: tenant.services || [],
        categories: categorySlugs, // Return slugs instead of ObjectIds
        subcategories: subcategorySlugs, // Return slugs instead of ObjectIds
        website: tenant.website || "",
        image: tenant.image, // This will now be the populated image object or null
        phone: tenant.phone || "",
        hourlyRate: tenant.hourlyRate || 1,
      };

      return result;
    } catch (error) {
      console.error("Error in getVendorProfile:", error);
      throw error;
    }
  }),

  updateUserProfile: clerkProcedure
    .input(profileSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // Find the user
      const user = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: userId } },
        limit: 1,
      });

      if (user.totalDocs === 0) {
        throw new Error("User not found");
      }

      const currentUser = user.docs[0];

      if (!currentUser) {
        throw new Error("User not found");
      }

      // If user provides coordinates, mark them as manually set and preserve existing metadata
      let updatedCoordinates = input.coordinates;
      if (hasValidCoordinates(input.coordinates) && input.coordinates) {
        const existingCoords = currentUser.coordinates as
          | Partial<UserCoordinates>
          | undefined;
        updatedCoordinates = {
          lat: input.coordinates.lat,
          lng: input.coordinates.lng,
          city: input.coordinates.city ?? existingCoords?.city,
          country: input.coordinates.country ?? existingCoords?.country,
          region: input.coordinates.region ?? existingCoords?.region,
          postalCode: input.coordinates.postalCode ?? existingCoords?.postalCode,
          street: input.coordinates.street ?? existingCoords?.street,
          ipDetected: false, // Manual coordinates
          manuallySet: true, // Lock against IP overwrite
        };
      }

      await ctx.db.update({
        collection: "users",
        id: currentUser.id as string,
        data: {
          username: input.username,
          location: input.location,
          country: input.country,
          language: input.language,
          coordinates: updatedCoordinates,
          onboardingCompleted: true, // Mark onboarding as complete
          geoUpdatedAt: new Date().toISOString(),
        },
      });

      // Update Clerk user metadata with the new username
      if (typeof currentUser.id === "string" && currentUser.id.length > 0) {
        await updateClerkUserMetadata(
          userId!,
          currentUser.id,
          input.username || undefined
        );
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "updateUserProfile: currentUser.id is null/empty; skipping Clerk metadata update"
          );
        }
      }

      return currentUser;
    }),

  updateUserCoordinates: clerkProcedure
    .input(
      z.object({
        coordinates: z.object({
          lat: z.number(),
          lng: z.number(),
          city: z.string().nullable().optional(),
          country: z.string().nullable().optional(),
          region: z.string().nullable().optional(),
          postalCode: z.string().nullable().optional(),
          street: z.string().nullable().optional(),
        }),
        // NEW: Optional top-level fields
        country: z.string().optional(),  // top-level display name
        language: z.string().optional(), // consider narrowing server-side
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const user = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: userId } },
        limit: 1,
      });

      if (user.totalDocs === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const currentUser = user.docs[0];
      if (!currentUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get existing coordinates to preserve metadata
      const existing = currentUser.coordinates as
        | Partial<UserCoordinates>
        | undefined;

      // NEW: Refined belt-and-suspenders guard - ironclad protection
      const hasManual = existing?.manuallySet === true;
      const doneOnboarding = currentUser.onboardingCompleted === true;
      // robust numeric check (null/undefined/NaN safe)
      const haveCoords = Number.isFinite(existing?.lat) && Number.isFinite(existing?.lng);

      // freeze geo writes only when it's truly safe to do so
      if (hasManual || (doneOnboarding && haveCoords)) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`Geo update skipped for ${String(userId).slice(0,8)}… (manual or completed)`);
        }
        return { success: true, stored: false, coordinates: existing };
      }

      // Round coordinates to 3 decimal places for privacy and consistency
      const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

      // Prepare incoming coordinates
      const incoming = {
        country: input.coordinates.country ?? null,
        region: input.coordinates.region ?? null,
        city: input.coordinates.city ?? null,
        postalCode: input.coordinates.postalCode ?? null,
        street: input.coordinates.street ?? null,
        lat:
          input.coordinates.lat != null
            ? round(input.coordinates.lat, 3)
            : null,
        lng:
          input.coordinates.lng != null
            ? round(input.coordinates.lng, 3)
            : null,
      };

      // Merge incoming with existing data, preserving manual flag if it exists
      const merged = {
        country: incoming.country ?? existing?.country ?? null,
        region: incoming.region ?? existing?.region ?? null,
        city: incoming.city ?? existing?.city ?? null,
        postalCode: incoming.postalCode ?? existing?.postalCode ?? null,
        street: incoming.street ?? existing?.street ?? null,
        lat: incoming.lat ?? existing?.lat ?? null,
        lng: incoming.lng ?? existing?.lng ?? null,
        ipDetected: true,
        manuallySet: existing?.manuallySet ?? false, // Preserve existing manual flag
      };

      // Check if anything actually changed
      const changed =
        merged.country !== existing?.country ||
        merged.region !== existing?.region ||
        merged.city !== existing?.city ||
        merged.postalCode !== existing?.postalCode ||
        merged.street !== existing?.street ||
        merged.lat !== existing?.lat ||
        merged.lng !== existing?.lng;

      // Prepare updates object
      const updates: Record<string, unknown> = {
        coordinates: merged,
        geoUpdatedAt: new Date().toISOString(),
      };

      // NEW: Only update top-level fields if onboarding is not completed
      if (!currentUser.onboardingCompleted) {
        if (input.country) updates.country = input.country;
        if (input.language) updates.language = input.language;
      }

      // Apply all updates in a single operation
      await ctx.db.update({
        collection: "users",
        id: currentUser.id as string,
        data: updates,
      });

      // Log high-level outcome (avoid PII)
      console.log(
        `Geo update for user ${userId!.slice(0, 8)}...: stored=${changed}, country=${merged.country || "unknown"}`
      );

      return {
        success: true,
        stored: changed,
        coordinates: merged,
      };
    }),
});
