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

    // console.log("session headers", headers);

    // console.log("session", session);

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
    .input(
      registerSchema
      // z.object({
      //   email: z.string().email(),
      //   password: z.string().min(6),
      //   username: z
      //     .string()
      //     .min(3, "Username must be at least 3 characters long")
      //     .max(63, "Username must be at most 63 characters long")
      //     .regex(
      //       /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      //       "Username can only contain lowercase letters, numbers and hypens. It must start and end with a letter or a number."
      //     )
      //     .refine(
      //       (val) => !val.includes("--"),
      //       "Username cannot contain consecutive hyphens."
      //     )
      //     .transform((val) => val.toLowerCase()),
      // })
    )
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

      // create stripe account:
      const account = await stripe.accounts.create({});

      if (!account.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to create Stripe account",
        });
      }

      // create tenant:
      const tenant = await ctx.db.create({
        collection: "tenants",
        data: {
          name: input.username,
          slug: input.username,
          // stripeAccountId: "test",
          stripeAccountId: account.id, // store the stripe account id
        },
      });

      await ctx.db.create({
        collection: "users",
        data: {
          email: input.email,
          username: input.username,
          // password: input.password,
          tenants: [
            {
              tenant: tenant.id, // this is an array becaue plugin allows user to have multiple tenants / not reflected in this app
            },
          ],
        },
      });

      // after user is created, login the user and set the cookie after the register (copy loginn and cookie procedure form below):
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
      // const cookies = await getCookies();
      // cookies.set({
      //   name: AUTH_COOKIE,
      //   value: data.token,
      //   httpOnly: true,
      //   path: "/",
      //   // TODO: ensure cross-domain coookie sharing
      //   // sameSite: "none",
      //   // domain: ""
      //   // "funroad.com" // initial cookie
      //   // antonio.funroad.com // cookie does not exist here
      // });
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

      if (!existingUser.tenants || existingUser.tenants.length === 0) {
        const account = await stripe.accounts.create();

        const tenant = await ctx.db.create({
          collection: "tenants",
          data: {
            name: username,
            slug: username,
            stripeAccountId: account.id,
          },
        });

        const updatedUser = await ctx.db.update({
          collection: "users",
          id: existingUser.id,
          data: {
            tenants: [{ tenant: tenant.id }],
          },
        });

        await updateClerkUserMetadata(userId, updatedUser.id, updatedUser.username);

        console.log("ADDED TENANT TO EXISTING USER:", updatedUser);
        return updatedUser;
      }

      // Optional: Keep Clerk in sync if needed
      await updateClerkUserMetadata(userId, existingUser.id, existingUser.username);

      return existingUser;
    }

    // New user flow
    const account = await stripe.accounts.create();

    const tenant = await ctx.db.create({
      collection: "tenants",
      data: {
        name: username,
        slug: username,
        stripeAccountId: account.id,
      },
    });
    console.log("CREATED TENANT OBJECT:", tenant);

    const user = await ctx.db.create({
      collection: "users",
      data: {
        email,
        username,
        clerkUserId: userId,
        roles: ["user"],
        tenants: [{ tenant: tenant.id }],
      },
    });

    await updateClerkUserMetadata(userId, user.id, user.username);

    console.log("CREATED USER OBJECT WITH TENANT:", user);

    return user;
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
      
      console.log("Raw tenant object:", tenantId);
      console.log("Tenant type:", typeof tenantId);
      
      // Ensure we have the correct tenant ID
      const actualTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId;
      
      console.log("Tenant ID:", actualTenantId);
      console.log("Input data:", input);
      console.log("Categories:", input.categories);
      console.log("Subcategories:", input.subcategories);
      
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
        console.log("Converted category slugs to IDs:", categoryIds);
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
          subcategories: input.subcategories, // Array of subcategory ObjectIds (already correct)
          website: input.website,
          image: input.image,
          hourlyRate: input.hourlyRate, // This will be a number after schema transformation
        },
      });

      console.log("UPDATED TENANT WITH VENDOR PROFILE:", updatedTenant);
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
      console.log("Getting vendor profile for userId:", userId);
      
      // Find the user
      const user = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: userId } },
        limit: 1,
      });

      if (user.totalDocs === 0) {
        console.log("User not found");
        throw new Error("User not found");
      }

      const currentUser = user.docs[0];
      console.log("Found user:", currentUser.username);
      
      // Find the tenant through the user's tenant relationship
      if (!currentUser.tenants || currentUser.tenants.length === 0) {
        console.log("No tenant associated with user");
        return null; // No tenant associated with user
      }

      const tenantId = currentUser.tenants[0].tenant;
      const actualTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId;
      console.log("Tenant ID:", actualTenantId);
      
      // Get the tenant by ID
      const tenant = await ctx.db.findByID({
        collection: "tenants",
        id: actualTenantId,
      });

      if (!tenant) {
        console.log("No tenant found");
        return null; // No vendor profile exists yet
      }

      console.log("Found tenant:", tenant);

      // Convert category ObjectIds to slugs
      let categorySlugs: string[] = [];
      if (tenant.categories && tenant.categories.length > 0) {
        console.log("Converting categories:", tenant.categories);
        
        // Extract just the IDs from the category objects
        const categoryIds = tenant.categories.map(cat => 
          typeof cat === 'object' && cat.id ? cat.id : cat
        );
        console.log("Extracted category IDs:", categoryIds);
        
        const categoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            id: { in: categoryIds }
          },
          limit: 100
        });
        categorySlugs = categoryDocs.docs.map(doc => doc.slug);
        console.log("Category slugs:", categorySlugs);
      }

      // Convert subcategory ObjectIds to slugs
      let subcategorySlugs: string[] = [];
      if (tenant.subcategories && tenant.subcategories.length > 0) {
        console.log("Converting subcategories:", tenant.subcategories);
        
        // Extract just the IDs from the subcategory objects
        const subcategoryIds = tenant.subcategories.map(sub => 
          typeof sub === 'object' && sub.id ? sub.id : sub
        );
        console.log("Extracted subcategory IDs:", subcategoryIds);
        
        const subcategoryDocs = await ctx.db.find({
          collection: "categories",
          where: {
            id: { in: subcategoryIds }
          },
          limit: 100
        });
        subcategorySlugs = subcategoryDocs.docs.map(doc => doc.slug);
        console.log("Subcategory slugs:", subcategorySlugs);
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
        hourlyRate: tenant.hourlyRate || 1,
      };
      
      console.log("Returning vendor profile data:", result);
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

      console.log("UPDATED USER PROFILE:", currentUser);
      return currentUser;
    }),
});
