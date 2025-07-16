import { initTRPC, TRPCError } from "@trpc/server";
// import { cache } from "react";
import superjson from "superjson";
import config from "@payload-config";
import { getPayload } from "payload";
import { auth } from "@clerk/nextjs/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

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

// Export type for context to use in routers:
export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

//  expanding the context (adding auth and headers), not removing it.
const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
// export const baseProcedure = t.procedure;

export const baseProcedure = t.procedure.use(async ({ next }) => {
  // connect to payload:
  const payload = await getPayload({ config });
  return next({ ctx: { db: payload } });
});

export const clerkProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.auth?.userId) {
    // throw new Error("UNAUTHORIZED");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return next({ ctx: { ...ctx, userId: ctx.auth.userId } });
});

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
