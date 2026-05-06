import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) => {
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
