import { headers as getHeaders, cookies as getCookies } from "next/headers";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
// import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AUTH_COOKIE } from "../constants";
import { registerSchema, loginSchema } from "../schemas";
import { generateAuthCookie } from "../utils";
import { stripe } from "@/lib/stripe";

export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    const headers = await getHeaders();

    const session = await ctx.db.auth({
      headers,
    });

    return session;
  }),

  // logout procedure:
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
          password: input.password, // This will be hashed by payload
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
  login: baseProcedure
    .input(
      // z.object({
      //   email: z.string().email(),
      //   password: z.string().min(6),
      // })
      loginSchema
    )
    .mutation(async ({ ctx, input }) => {
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
      //   // name: AUTH_COOKIE,
      //   name: `${ctx.db.config.cookiePrefix}-token`, // payload default cookie name
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
});
