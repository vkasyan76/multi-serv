import { headers as getHeaders, cookies as getCookies } from "next/headers";
import { baseProcedure, createTRPCRouter, clerkProcedure } from "@/trpc/init";
// import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AUTH_COOKIE } from "../constants";
import { registerSchema, loginSchema } from "../schemas";
import {
  clean,
  generateAuthCookie,
  normalizeUrl,
  resolveUserTenant,
  servicesToDescription,
} from "../utils";
import { stripe } from "@/lib/stripe";
import { updateClerkUserMetadata } from "@/lib/auth/updateClerkMetadata";
import { vendorSchema, profileSchema } from "@/modules/profile/schemas";
import { z } from "zod";
import type { UserCoordinates } from "@/modules/tenants/types";
import {
  hasValidCoordinates,
  replaceCoordinates,
} from "@/modules/profile/location-utils";
import { checkVatWithTimeout } from "@/modules/profile/server/services/vies";

// Consistent ID masking helper for PII protection
const mask = (v: unknown) => `${String(v ?? "").slice(0, 8)}…`;

// strip ISO prefix and separators from VAT for VIES check

const normalizeVatForVies = (countryISO: string, raw: string) => {
  const iso = (countryISO || "").toUpperCase().slice(0, 2);
  let n = (raw || "").toUpperCase().replace(/[\s.\-]/g, "");
  if (n.startsWith(iso)) n = n.slice(iso.length);
  return { iso, vat: n };
};

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
    const userId = ctx.userId;
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

      let accountId: string | undefined; // <-- just the id, visible to catch
      let tenant: { id: string } | null = null;

      try {
        // explicitly creating an Express connected account.
        // Express gives you Stripe’s hosted onboarding UI and handles KYC/TOS. That keeps your compliance surface small and is the recommended fit for marketplaces/platforms.
        // Idempotency key prevents duplicate connected accounts if the request is retried (network flap, user double-click, server restart).
        // Metadata (e.g., your platform’s user/tenant IDs) makes debugging and reconciliation easier in the Stripe Dashboard.
        if (!currentUser || typeof currentUser.id !== "string") {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const platformUserId = String(currentUser.id);

        ({ id: accountId } = await stripe.accounts.create(
          {
            type: "express",
            capabilities: {
              card_payments: { requested: true },
              transfers: { requested: true },
            }, // direct charges
            business_profile: {
              name: input.name ?? currentUser.username ?? undefined,
              url:
                normalizeUrl(input.website) ??
                `https://infinisimo.com/${encodeURIComponent(input.name ?? currentUser.username ?? "")}`,
              product_description: servicesToDescription(input.services),
              support_email: clean(currentUser.email),
              support_phone: clean(input.phone),
              support_url: normalizeUrl(input.website),
              // (handles whitespace + “www.” URLs
            },
            metadata: {
              platformUserId,
              tenantName: input.name ?? "",
            },
          },
          { idempotencyKey: `acct_create:${currentUser.id}:card+transfers:v2` }
        ));

        if (!accountId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Stripe account",
          });
        }

        // Authoritative country: prefer user's profile ISO, then input, then DE
        const countryForTenant = (
          input.country ||
          (currentUser.coordinates as UserCoordinates | undefined)
            ?.countryISO ||
          "DE"
        ).toUpperCase();

        // ⬇️ VIES re-check before writing
        let vatIdValid = false;
        if (input.vatRegistered && input.vatId) {
          try {
            const { iso, vat } = normalizeVatForVies(
              countryForTenant,
              input.vatId
            );
            const res = await checkVatWithTimeout(iso, vat);
            vatIdValid = !!res.valid;
          } catch {
            // keep false on failures/timeouts
          }
        }

        // Create tenant with vendor profile data
        tenant = await ctx.db.create({
          collection: "tenants",
          data: {
            name: input.name || currentUser?.username || "",
            slug: input.name || currentUser?.username || "", // Use business name as slug for routing
            stripeAccountId: accountId,
            firstName: input.firstName,
            lastName: input.lastName,
            bio: input.bio,
            services: input.services,
            categories: categoryIds,
            subcategories: subcategoryIds,
            website: normalizeUrl(input.website),
            image: input.image,
            phone: input.phone,
            hourlyRate: input.hourlyRate,
            // ⬇️ VAT + country
            country: countryForTenant,
            vatRegistered: !!input.vatRegistered,
            vatId: input.vatRegistered
              ? input.vatId?.trim() || null // persist null if somehow empty
              : null, // toggle off => clear explicitly
            vatIdValid, // ⬅️ authoritative server flag

            user: currentUser!.id,
          },
          overrideAccess: true, // Bypass access control to ensure creation
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
          overrideAccess: true, // Bypass access control to ensure tenant creation
        });

        return tenant;
      } catch (error) {
        let tenantDeleted = false;

        /**
         * Failure handling playbook:
         * 1) If we managed to create a tenant doc, try to roll it back.
         *    Record whether that rollback actually succeeded.
         * 2) If a Stripe account was created, delete it when:
         *      - the tenant was never persisted, OR
         *      - the tenant rollback succeeded.
         *    If tenant rollback failed, we intentionally keep the Stripe account so
         *    that external (Stripe) and internal (DB) state remain aligned for follow-up cleanup.
         * 3) Rethrow the original error so the caller can handle it.
         */

        // 1) Try to roll back tenant if it was created
        if (tenant?.id) {
          await ctx.db
            .delete({ collection: "tenants", id: tenant.id })
            .then(() => {
              tenantDeleted = true;
            })
            .catch(() => {
              // swallow rollback failure; we don't want to mask the original error
            });
        }

        // Delete Stripe account if it was created and either:
        //  - tenant was never persisted, or
        //  - tenant rollback succeeded
        if (accountId && (!tenant || tenantDeleted)) {
          await stripe.accounts.del(accountId).catch(() => {
            // ignore cleanup errors so we don't mask the original error
          });
        } else if (
          accountId &&
          tenant &&
          !tenantDeleted &&
          process.env.NODE_ENV !== "production"
        ) {
          // Heads-up: tenant rollback failed but Stripe account exists; state is intentionally left consistent.
          console.warn(
            "[createVendorProfile] Orphan risk: tenant rollback failed; keeping Stripe account",
            { accountId: accountId.slice(0, 8) + "…", tenantId: tenant.id }
          );
        }

        throw error; // rethrow original problem
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

      // Authoritative country: prefer user's profile ISO, then input, then DE
      const countryForTenant = (
        (currentUser.coordinates as UserCoordinates | undefined)?.countryISO ||
        input.country ||
        "DE"
      ).toUpperCase();

      let vatIdValid = false;
      if (input.vatRegistered && input.vatId) {
        try {
          const { iso, vat } = normalizeVatForVies(
            countryForTenant,
            input.vatId
          );
          const res = await checkVatWithTimeout(iso, vat);
          vatIdValid = !!res.valid;
        } catch {
          // keep false on failures/timeouts
        }
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
            website: normalizeUrl(input.website),
            image: input.image || undefined, // Pass the file ID for the relationship
            phone: input.phone,
            hourlyRate: input.hourlyRate, // This will be a number after schema transformation
            // ⬇️ VAT + country
            country: countryForTenant,
            vatRegistered: !!input.vatRegistered,
            vatId: input.vatRegistered ? input.vatId?.trim() || null : null, // toggle off => clear
            vatIdValid: input.vatRegistered ? vatIdValid : false, // keep DB consistent
          },
        });

        // fetch the tenant (depth:0) to get its stripeAccountId  - update business profile in Stripe:
        const tenantDoc = await ctx.db.findByID({
          collection: "tenants",
          id: actualTenantId as string,
          depth: 0,
        });

        const acctId =
          typeof tenantDoc?.stripeAccountId === "string"
            ? tenantDoc.stripeAccountId
            : undefined;

        if (acctId) {
          await stripe.accounts.update(acctId, {
            business_profile: {
              name: input.name || undefined,
              url:
                normalizeUrl(input.website) ||
                `https://infinisimo.com/${encodeURIComponent(input.name)}`,
              product_description: servicesToDescription(input.services),
              support_phone: clean(input.phone),
              support_url: normalizeUrl(input.website) || undefined,
            },
          });
        }

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
            countryISO: (currentUser.coordinates as UserCoordinates).countryISO,
            countryName: (currentUser.coordinates as UserCoordinates)
              .countryName,
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
        // ⬇️ VAT + country
        country: (tenant.country as string) || "DE",
        vatRegistered: !!tenant.vatRegistered,
        vatId: (tenant.vatId as string) || "",
        vatIdValid: !!tenant.vatIdValid,
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
        updatedCoordinates = replaceCoordinates(input.coordinates, true);
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
          lat: z.number().finite(),
          lng: z.number().finite(),
          city: z.string().nullable().optional(),
          countryISO: z.string().nullable().optional(),
          countryName: z.string().nullable().optional(),
          region: z.string().nullable().optional(),
          postalCode: z.string().nullable().optional(),
          street: z.string().nullable().optional(),
        }),
        // NEW: Optional top-level fields
        country: z.string().optional(), // top-level display name
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
      const haveCoords =
        Number.isFinite(existing?.lat) && Number.isFinite(existing?.lng);

      // freeze geo writes only when it's truly safe to do so
      if (hasManual || (doneOnboarding && haveCoords)) {
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `Geo update skipped for ${String(userId).slice(0, 8)}… (manual or completed)`
          );
        }
        return { success: true, stored: false, coordinates: existing };
      }

      // Round coordinates to 3 decimal places for privacy and consistency
      const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

      // Prepare incoming coordinates - completely replace, don't merge
      const incoming = {
        countryISO: input.coordinates.countryISO ?? null,
        countryName: input.coordinates.countryName ?? null,
        region: input.coordinates.region ?? null,
        city: input.coordinates.city ?? null,
        postalCode: input.coordinates.postalCode ?? null,
        street: input.coordinates.street ?? null,
        lat:
          input.coordinates.lat != null
            ? round(input.coordinates.lat, 3)
            : undefined,
        lng:
          input.coordinates.lng != null
            ? round(input.coordinates.lng, 3)
            : undefined,
      };

      // Use incoming coordinates directly - no merging with existing data
      const merged = {
        countryISO: incoming.countryISO,
        countryName: incoming.countryName,
        region: incoming.region,
        city: incoming.city,
        postalCode: incoming.postalCode,
        street: incoming.street,
        lat: incoming.lat,
        lng: incoming.lng,
        ipDetected: true,
        manuallySet: existing?.manuallySet ?? false, // Preserve existing manual flag
      };

      // Check if anything actually changed
      const changed =
        merged.countryISO !== existing?.countryISO ||
        merged.countryName !== existing?.countryName ||
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
      const mask = (v?: string | null) =>
        v ? `${v.slice(0, 4)}…${v.slice(-2)}` : "unknown";

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Geo update for user ${mask(userId)}: stored=${changed}, countryISO=${merged.countryISO ?? "unknown"}`
        );
      }

      return {
        success: true,
        stored: changed,
        coordinates: merged,
      };
    }),

  //
  // -------- Stripe Onboarding & Status (NEW) --------
  //
  createOnboardingLink: clerkProcedure
    .input(z.void()) // no client-provided URLs
    .mutation(async ({ ctx }) => {
      const { stripeAccountId } = await resolveUserTenant(ctx.db, ctx.userId);

      const base =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.NEXT_PUBLIC_ROOT_DOMAIN
          ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
          : null);

      if (!base) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Missing NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_ROOT_DOMAIN for return URLs",
        });
      }

      const returnUrl = new URL(
        "/profile?tab=payouts&onboarding=done",
        base
      ).toString();
      const refreshUrl = new URL(
        "/profile?tab=payouts&resume=1",
        base
      ).toString();

      const link = await stripe.accountLinks.create({
        account: stripeAccountId,
        type: "account_onboarding",
        return_url: returnUrl,
        refresh_url: refreshUrl,
      });

      return { url: link.url };
    }),

  createDashboardLoginLink: clerkProcedure.mutation(async ({ ctx }) => {
    const { stripeAccountId } = await resolveUserTenant(ctx.db, ctx.userId);

    const ll = await stripe.accounts.createLoginLink(stripeAccountId);
    return { url: ll.url };
  }),

  getStripeStatus: clerkProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;

    const user = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: userId } },
      limit: 1,
    });
    if (user.totalDocs === 0)
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    const currentUser = user.docs[0];

    // Not a vendor yet → minimal response
    if (!currentUser?.tenants?.length) {
      return {
        hasTenant: false,
        onboardingStatus: "not_started" as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
      };
    }

    const tenantRef = currentUser.tenants[0]?.tenant;
    const tenantId = typeof tenantRef === "object" ? tenantRef.id : tenantRef;

    const tenant = await ctx.db.findByID({
      collection: "tenants",
      id: tenantId as string,
    });

    // If the tenant doc is missing (admin delete/migration), treat as no vendor yet
    if (!tenant) {
      return {
        hasTenant: false,
        onboardingStatus: "not_started" as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
      };
    }

    const accountId =
      typeof tenant.stripeAccountId === "string"
        ? tenant.stripeAccountId.trim()
        : "";

    if (!accountId) {
      // Tenant exists but has no Stripe id (shouldn’t happen with your flow)
      return {
        hasTenant: true,
        onboardingStatus: "not_started" as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
      };
    }

    // Pull fresh status from Stripe
    const acct = await stripe.accounts.retrieve(accountId);
    const chargesEnabled = !!acct.charges_enabled;
    const payoutsEnabled = !!acct.payouts_enabled;
    const requirementsDue = (acct.requirements?.currently_due ??
      []) as string[];
    const disabledReason = acct.requirements?.disabled_reason ?? null;

    const onboardingStatus: "completed" | "in_progress" | "restricted" =
      chargesEnabled && payoutsEnabled
        ? "completed"
        : disabledReason
          ? "restricted"
          : "in_progress";

    // Persist snapshot (keeps DB in sync even without webhook)
    await ctx.db.update({
      collection: "tenants",
      id: tenantId as string,
      data: {
        chargesEnabled,
        payoutsEnabled,
        stripeRequirements: requirementsDue,
        onboardingStatus,
        lastStripeSyncAt: new Date().toISOString(),
      },
    });

    return {
      hasTenant: true,
      onboardingStatus,
      chargesEnabled,
      payoutsEnabled,
      requirementsDue,
    };
  }),
});
