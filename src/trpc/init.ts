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

  // keep whatever you already return in ctx (payload, headers, etc.)
  let clerkAuth: Awaited<ReturnType<typeof auth>> | null = null;

  try {
    clerkAuth = await auth(); // will throw if Clerk middleware wasn't hit
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "createTRPCContext: no Clerk middleware context; continuing as anonymous"
      );
    }
    clerkAuth = null;
  }

  const userId = clerkAuth?.userId ?? null;

  const payload = await getPayload({ config });
  return {
    auth: clerkAuth,
    req,
    db: payload,
    headers,
    userId,
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

// export const baseProcedure = t.procedure.use(async ({ ctx, next }) => {
//   // connect to payload:
//   const payload = await getPayload({ config });
//   // Merge: keep existing context (auth, userId, headers, req) and add/update db
//   return next({ ctx: { ...ctx, db: payload } });
// });

// optimized baseProcedure - No wasted work - If createTRPCContext already put db on ctx, we don’t build it again. That saves an extra async init per call and avoids creating two clients per request.
export const baseProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.db) {
    // only if missing
    const payload = await getPayload({ config }); // create Payload client
    ctx = { ...ctx, db: payload }; // attach it once
  }
  return next({ ctx }); // keep everything else intact
});

export const clerkProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.auth?.userId) {
    // throw new Error("UNAUTHORIZED");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  // ctx already contains userId from createTRPCContext
  // return next();
  // (If you prefer being explicit, you can still do:)
  return next({ ctx: { ...ctx, userId: ctx.userId } });
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
