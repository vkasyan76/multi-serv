import { DEFAULT_APP_LANG } from "@/lib/i18n/app-lang";
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
      locale: ctx.appLang,
      fallbackLocale: DEFAULT_APP_LANG,
      pagination: false, // Disable pagination to get all categories
      where: {
        parent: {
          exists: false,
        },
      },
      sort: "name", // Sort categories by name
    });

    const formattedData = data.docs.map((doc) => ({
      // Keep workType explicit in the read contract so future filter/sorting UI
      // can group both root categories and subcategories without another API pass.
      ...doc,
      workType: doc.workType ?? null,
      subcategories: (doc.subcategories?.docs ?? []).map((subcategoryDoc) => ({
        // Because of "depth: 1" we are confident doc will be a type of category
        ...(subcategoryDoc as Category),
        workType: (subcategoryDoc as Category).workType ?? null,
        subcategories: undefined,
      })),
    }));

    return formattedData;
  }),
});
