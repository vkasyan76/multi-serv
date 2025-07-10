import { Category } from "@/payload-types";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";

// import configPromise from "@payload-config";
// import { getPayload } from "payload";

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async ({ ctx }) => {
    // const payload = await getPayload({
    //   config: configPromise,
    // });

    const data = await ctx.db.find({
      collection: "categories",
      depth: 1, // Populate subcategories, subcategories.[0] will be a type of "Category"
      pagination: false, // Disable pagination to get all categories
      where: {
        parent: {
          exists: false,
        },
      },
      sort: "name", // Sort categories by name
    });

    const formattedData = data.docs.map((doc) => ({
      ...doc,
      subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
        // Because of "depth: 1" we are confident doc will be a type of category
        ...(doc as Category),
        subcategories: undefined,
      })),
    }));

    return formattedData;
  }),
});
