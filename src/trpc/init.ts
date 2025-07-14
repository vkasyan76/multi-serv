import { initTRPC } from "@trpc/server";
// import { cache } from "react";
import superjson from "superjson";
import config from "@payload-config";
import { getPayload } from "payload";
// import { headers as getHeaders } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
// import type { NextApiRequest, NextApiResponse } from "next";

// export const createTRPCContext = cache(async () => {
//   /**
//    * @see: https://trpc.io/docs/server/context
//    */
//   return { userId: "user_123" };
// });

// tRPC Context Adjustment for Clerk:

export const createTRPCContext = async (opts?: FetchCreateContextFnOptions) => {
  const req = opts?.req;
  let headers: Record<string, string> = {};
  if (req) {
    headers = Object.fromEntries(req.headers.entries());
  }
  // Auth for Clerk (App Router): just call without args
  const authContext = await auth();
  const payload = await getPayload({ config });
  return {
    auth: authContext,
    req,
    db: payload,
    headers,
  };
};

// export const createTRPCContext = async (req: Request) => {
//   // const headers = Object.fromEntries(req.headers.entries());
//   let headers: Record<string, string> = {};
//   if (req) {
//     headers = Object.fromEntries(req.headers.entries());
//   }

//   // Auth: adjust if you need to pass headers/cookies to Clerk
//   const authContext = await auth(); // If Clerk needs headers, pass them
//   const db = { config }; // Make sure payloadConfig is your config!
//   return {
//     auth: authContext,
//     req, // This is the Web API Request, not NextApiRequest
//     db,
//     headers, // If you need for auth/cookies
//   };
// };

// Export type for context to use in routers:
export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// export const createTRPCContext = async ({
//   req,
//   res,
// }: {
//   req: NextApiRequest;
//   res: NextApiResponse;
// }) => {
//   const authContext = await auth();
//   // Get your payload config instance if needed, e.g. from req, or import/config directly.
//   // Example if you use db/config in ctx elsewhere:
//   // or however you get config!
//   const db = { config }; // Make sure payloadConfig is your config!
//   return {
//     auth: authContext,
//     req,
//     res,
//     db,
//   };
// };

// export const createTRPCContext = async ({ req, res }) => {
//   const authContext = await auth();
//   return {
//     auth: authContext,
//     req,
//     res,
//   };
// };

// export const createTRPCContext = async () => {
//   const clerkAuth = await auth();
//   return { auth: clerkAuth };
// };

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
// export const baseProcedure = t.procedure;

export const baseProcedure = t.procedure.use(async ({ next }) => {
  // connect to payload:
  const payload = await getPayload({ config });
  return next({ ctx: { db: payload } });
});

// Clerk auth middleware: baseProcedure wipes the context (only gives you { db })
// clerkProcedure merges context ({ ...ctx, db }), so you get everything else (like auth, req, etc.)
// export const clerkProcedure = t.procedure.use(async ({ ctx, next }) => {
//   const payload = await getPayload({ config });
//   return next({
//     ctx: { ...ctx, db: payload }, // preserve existing ctx, add db
//   });
// });
const t_new = initTRPC.context<TRPCContext>().create();
export const clerkProcedure = t_new.procedure.use(async ({ ctx, next }) => {
  if (!ctx.auth?.userId) {
    throw new Error("UNAUTHORIZED");
  }
  return next({ ctx: { ...ctx, userId: ctx.auth.userId } });
});
// export const clerkProcedure = t_new.procedure
//   .use(async ({ ctx, next }) => {
//     // Check auth from context (provided by createTRPCContext)
//     if (!ctx.auth?.userId) throw new Error("UNAUTHORIZED");
//     return next({ ctx: { ...ctx, userId: ctx.auth.userId } }); // If you want userId as shortcut
//   })
//   .use(async ({ ctx, next }) => {
//     // Add payload db instance
//     const payload = await getPayload({ config });
//     return next({ ctx: { ...ctx, db: payload } }); // Always ...ctx!
//   });

// protected procedure - only if the user is logged in
// export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
//   const headers = await getHeaders();
//   const session = await ctx.db.auth({
//     headers,
//   });

//   if (!session.user) {
//     throw new TRPCError({
//       code: "UNAUTHORIZED",
//       message: "Not authenticated",
//     });
//   }
//   return next({
//     ctx: {
//       ...ctx,
//       session: {
//         ...session,
//         user: session.user,
//       },
//     },
//   });
// });
