import { headers as getHeaders, cookies as getCookies } from "next/headers";
import { baseProcedure, createTRPCRouter, clerkProcedure } from "@/trpc/init";
// import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AUTH_COOKIE } from "../constants";
import { registerSchema, loginSchema } from "../schemas";
import { generateAuthCookie } from "../utils";
import { stripe } from "@/lib/stripe";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { updateClerkUserMetadata } from "@/lib/auth/updateClerkMetadata";
import { vendorSchema, profileSchema } from "@/modules/profile/schemas";

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
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.primaryEmailAddress?.emailAddress || "";
    const username = clerkUser.username || email.split("@")[0];

    const existing = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: userId } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      const existingUser = existing.docs[0];

      // Don't auto-create tenant - let user decide when to become vendor
      // Optional: Keep Clerk in sync if needed
      await updateClerkUserMetadata(userId, existingUser.id, existingUser.username);

      return existingUser;
    }

    // New user flow - create user only, no tenant
    const user = await ctx.db.create({
      collection: "users",
      data: {
        email,
        username,
        clerkUserId: userId,
        roles: ["user"],
        // No tenants initially - will be added when user becomes vendor
      },
    });

    await updateClerkUserMetadata(userId, user.id, user.username);

    return user;
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
          message: "User not found"
        });
      }

      const currentUser = user.docs[0];
      
      // Check if user already has a tenant (vendor profile)
      if (currentUser.tenants && currentUser.tenants.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST", 
          message: "User already has a vendor profile"
        });
      }

      // Convert category slugs to ObjectIds
      let categoryIds: string[] = [];
      if (input.categories && input.categories.length > 0) {
        const categoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.categories }
          },
          limit: 100
        });
        categoryIds = categoryDocs.docs.map(doc => doc.id);
      }
      
      // Convert subcategory slugs to ObjectIds
      let subcategoryIds: string[] = [];
      if (input.subcategories && input.subcategories.length > 0) {
        const subcategoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.subcategories }
          },
          limit: 100
        });
        subcategoryIds = subcategoryDocs.docs.map(doc => doc.id);
      }
      
      let account: { id?: string } | null = null;
      let tenant: { id: string } | null = null;
      
      try {
        // Create Stripe account for the vendor
        account = await stripe.accounts.create();
        
        if (!account.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Stripe account"
          });
        }
        
        // Create tenant with vendor profile data
        tenant = await ctx.db.create({
          collection: "tenants",
          data: {
            name: input.name || currentUser.username,
            slug: currentUser.username,
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
          },
        });

        // Link tenant to user
        await ctx.db.update({
          collection: "users",
          id: currentUser.id,
          data: {
            tenants: [{ tenant: tenant.id }],
          },
        });

        return tenant;
      } catch (error) {
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
      if (!currentUser.tenants || currentUser.tenants.length === 0) {
        throw new Error("No tenant found for user");
      }

      const tenantId = currentUser.tenants[0].tenant;
      
      // Ensure we have the correct tenant ID
      const actualTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId;
      
      // Convert category slugs to ObjectIds
      let categoryIds: string[] = [];
      if (input.categories && input.categories.length > 0) {
        const categoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.categories }
          },
          limit: 100
        });
        categoryIds = categoryDocs.docs.map(doc => doc.id);
      }
      
      // Convert subcategory slugs to ObjectIds
      let subcategoryIds: string[] = [];
      if (input.subcategories && input.subcategories.length > 0) {
        const subcategoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            slug: { in: input.subcategories }
          },
          limit: 100
        });
        subcategoryIds = subcategoryDocs.docs.map(doc => doc.id);
      }
      
      // Update the tenant with vendor profile data
      const updatedTenant = await ctx.db.update({
        collection: "tenants",
        id: actualTenantId as string,
        data: {
          name: input.name,
          firstName: input.firstName,
          lastName: input.lastName,
          bio: input.bio,
          services: input.services,
          categories: categoryIds, // Array of category ObjectIds
          subcategories: subcategoryIds, // Array of subcategory ObjectIds
          website: input.website,
          image: input.image,
          phone: input.phone,
          hourlyRate: input.hourlyRate, // This will be a number after schema transformation
        },
      });

      return updatedTenant;
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
      throw new Error("User not found");
    }

    const currentUser = user.docs[0];
    
    return {
      username: currentUser.username,
      email: currentUser.email,
      location: currentUser.location || "",
      country: currentUser.country || "",
      language: currentUser.language || "en",
      coordinates: currentUser.coordinates,
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
      
      // Find the tenant through the user's tenant relationship
      if (!currentUser.tenants || currentUser.tenants.length === 0) {
        return null; // No tenant associated with user
      }

      const tenantId = currentUser.tenants[0].tenant;
      const actualTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId;
      
      // Get the tenant by ID
      const tenant = await ctx.db.findByID({
        collection: "tenants",
        id: actualTenantId,
      });

      if (!tenant) {
        return null; // No vendor profile exists yet
      }

      // Convert category ObjectIds to slugs
      let categorySlugs: string[] = [];
      if (tenant.categories && tenant.categories.length > 0) {
        // Extract just the IDs from the category objects
        const categoryIds = tenant.categories.map(cat => 
          typeof cat === 'object' && cat.id ? cat.id : cat
        );
        
        const categoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            id: { in: categoryIds }
          },
          limit: 100
        });
        categorySlugs = categoryDocs.docs.map(doc => doc.slug);
      }

      // Convert subcategory ObjectIds to slugs
      let subcategorySlugs: string[] = [];
      if (tenant.subcategories && tenant.subcategories.length > 0) {
        // Extract just the IDs from the subcategory objects
        const subcategoryIds = tenant.subcategories.map(sub => 
          typeof sub === 'object' && sub.id ? sub.id : sub
        );
        
        const subcategoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            id: { in: subcategoryIds }
          },
          limit: 100
        });
        subcategorySlugs = subcategoryDocs.docs.map(doc => doc.slug);
      }
      
      const result = {
        name: tenant.name || "",
        firstName: tenant.firstName || "",
        lastName: tenant.lastName || "",
        bio: tenant.bio || "",
        services: tenant.services || [],
        categories: categorySlugs, // Return slugs instead of ObjectIds
        subcategories: subcategorySlugs, // Return slugs instead of ObjectIds
        website: tenant.website || "",
        image: tenant.image || "",
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
      
      // Update the user with profile data
      await ctx.db.update({
        collection: "users",
        id: currentUser.id as string,
        data: {
          username: input.username,
          location: input.location,
          country: input.country,
          language: input.language,
          coordinates: input.coordinates,
          onboardingCompleted: true, // Set onboarding status to completed
        },
      });

      // Update Clerk user metadata with the new username
      await updateClerkUserMetadata(userId, currentUser.id, input.username);

      return currentUser;
    }),
});
