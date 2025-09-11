import { initTRPC, TRPCError } from "@trpc/server";
// import { cache } from "react";
import superjson from "superjson";
import config from "@payload-config";
import { getPayload } from "payload";
import { auth } from "@clerk/nextjs/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { headers as nextHeaders } from "next/headers";

// ★ NEW: import the small helper (optional but keeps init.ts tidy)
import { readBridgeUidFromRequest } from "./auth-utils";

export const createTRPCContext = async (opts?: FetchCreateContextFnOptions) => {
  // const BRIDGE_COOKIE = "inf_br";

  const req = opts?.req;
  let headers: Record<string, string> = {};
  if (req) {
    headers = Object.fromEntries(req.headers.entries());
  } else {
    try {
      const h = await nextHeaders(); // <-- keep await for current types
      headers = Object.fromEntries(h.entries());
    } catch {
      headers = {};
    }
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

  // ★ NEW (non-intrusive): use the helper instead of duplicating the logic:
  const bridgedUid = await readBridgeUidFromRequest(req);

  const userId = clerkAuth?.userId ?? bridgedUid ?? null;

  // ★ OPTIONAL (debug-only): record where identity came from; harmless to include
  const authSource: "clerk" | "bridge-cookie" | "none" = clerkAuth?.userId
    ? "clerk"
    : bridgedUid
      ? "bridge-cookie"
      : "none";

  const payload = await getPayload({ config });
  return {
    auth: clerkAuth,
    req,
    db: payload,
    headers,
    userId,
    authSource, // optional, handy in logs / debugging
  };
};

// Export type for context to use in routers:
export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

//  expanding the context (adding auth and headers), not removing it.
const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const baseProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.db) {
    // only if missing
    const payload = await getPayload({ config }); // create Payload client
    ctx = { ...ctx, db: payload }; // attach it once
  }
  return next({ ctx }); // keep everything else intact
});

export const clerkProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
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
