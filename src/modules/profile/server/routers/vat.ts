// server-only router (never import from the client bundle)
import "server-only";
import { z } from "zod";

// ✅ import TRPC helpers from YOUR setup
import { createTRPCRouter, baseProcedure } from "@/trpc/init";

// Your existing server-only fetcher
import { checkVatWithTimeout } from "../services/vies";

// Reusable input schema
const vatInput = z.object({
  countryCode: z
    .string()
    .length(2, "ISO2 required")
    .transform((s) => s.toUpperCase()),
  vat: z.string().min(2, "VAT required"),
});

export const vatRouter = createTRPCRouter({
  validate: baseProcedure.input(vatInput).mutation(async ({ input }) => {
    // typed `input` (no "any") and calls your server-only VIES service
    return await checkVatWithTimeout(input.countryCode, input.vat);
  }),
});

export type VatRouter = typeof vatRouter;
