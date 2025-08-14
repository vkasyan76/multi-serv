import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

// Log available procedures once on boot
console.log('tRPC procedures:', Object.keys(appRouter._def.procedures));

const handler = (req: Request) => {
  // Log the request path hitting the handler
  const u = new URL(req.url);
  console.log('tRPC hit:', u.pathname, u.search);
  
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts),
    onError({ path, type, error }) {
      console.error("tRPC error", { path, type, code: error.code, msg: error.message });
    },
  });
};

export { handler as GET, handler as POST };
