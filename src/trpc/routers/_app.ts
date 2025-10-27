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
import { bookingRouter } from "@/modules/bookings/server/procedures";
import { checkoutRouter } from "@/modules/checkout/server/procedures";
import { vatRouter } from "@/modules/profile/server/routers/vat";
import { ordersRouter } from "@/modules/orders/server/procedures";

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
  // reviews: reviewsRouter,
  categories: categoriesRouter,
  bookings: bookingRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  vat: vatRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
