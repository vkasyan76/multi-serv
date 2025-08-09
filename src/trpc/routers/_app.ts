// import { z } from "zod";

import { createTRPCRouter } from "../init";
import { authRouter } from "@/modules/auth/server/procedures";
import { categoriesRouter } from "@/modules/categories/server/procedures";
// import { checkoutRouter } from "@/modules/checkout/server/procedures";
// import { libraryRouter } from "@/modules/library/server/procedures";
// import { productsRouter } from "@/modules/products/server/procedures";
// import { reviewsRouter } from "@/modules/reviews/server/procedures";
import { tagsRouter } from "@/modules/tags/server/procedures";
import { tenantsRouter } from "@/modules/tenants/server/procedures";

export const appRouter = createTRPCRouter({
  // hello: baseProcedure
  //   .input(
  //     z.object({
  //       text: z.string(),
  //     })
  //   )
  //   .query((opts) => {
  //     return {
  //       greeting: `hello ${opts.input.text}`,
  //     };
  //   }),
  auth: authRouter,
  tags: tagsRouter,
  tenants: tenantsRouter,
  // library: libraryRouter,
  // reviews: reviewsRouter,
  // checkout: checkoutRouter,
  categories: categoriesRouter,
  // products: productsRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
