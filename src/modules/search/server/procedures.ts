import { z } from "zod";

import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import type { SearchSuggestion } from "@/modules/search/types";

export const searchRouter = createTRPCRouter({
  suggest: baseProcedure
    .input(
      z.object({
        query: z.string().trim().max(100),
        limit: z.number().min(1).max(10).default(6),
      })
    )
    .query(async ({ input }) => {
      if (input.query.length < 2) {
        return [] as SearchSuggestion[];
      }

      // Stage 2/3 will add:
      // - shared live taxonomy reads
      // - bounded tenant candidate reads
      // - synonym candidates
      // - normalized scoring
      // - href resolution
      // - explicit marketplace fallback
      return [] as SearchSuggestion[];
    }),
});
