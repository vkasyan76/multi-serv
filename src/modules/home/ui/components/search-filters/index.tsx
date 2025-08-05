"use client";

// import { Category } from "@/payload-types";
// import { CustomCategory } from "../types";
import { Categories } from "./categories";
import { SearchInput } from "./search-input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useParams } from "next/navigation";
import { DEFAULT_BG_COLOR } from "../../../constants";
import { BreadcrumbNavigation } from "./breadcrumbs-navigation";

// interface Props {
//   data: CustomCategory[];
//   // data: any;
//   // data: Category[];
// }

export const SearchFilters = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.categories.getMany.queryOptions());

  // make the backgroundcolor in the style dynamic depending on the category to which we are redirected:
  const params = useParams();
  const categoryParam = params.category as string | undefined;
  const activeCategory = categoryParam || "all";
  const activeCategoryData = data.find(
    (category) => category.slug === activeCategory
  );

  // we pass background color:
  const activeCategoryColor = activeCategoryData?.color || DEFAULT_BG_COLOR;

  // For Breadcrumnb Navigation:
  const activeCategoryName = activeCategoryData?.name || null;
  const activeSubcategory = params.subcategory as string | undefined;
  const activeSubcategoryName =
    activeCategoryData?.subcategories?.find(
      (subcategory) => subcategory.slug === activeSubcategory
    )?.name || null;

  return (
    <div
      className="px-4 lg:px-12 py-8 border-b flex flex-col gap-4 w-full"
      // style={{ backgroundColor: "#F5F5F5" }}
      style={{ backgroundColor: activeCategoryColor }}
    >
      {/* {JSON.stringify(data, null, 2)} */}
      {/* <SearchInput data={data} /> */}
      {/* We don’t need to pass data to SearchInput - category sidebar fetches the data independently */}
      <SearchInput />
      {/* Hide Categories on Mobile */}
      <div className="hidden lg:block">
        <Categories data={data} />
      </div>
      <BreadcrumbNavigation
        activeCategoryName={activeCategoryName}
        activeCategory={activeCategory}
        activeSubcategoryName={activeSubcategoryName}
      />
    </div>
  );
};

export const SearchFiltersSkeleton = () => {
  return (
    <div
      className="px-4 lg:px-12 py-8 border-b flex flex-col gap-4 w-full"
      style={{ backgroundColor: "#F5F5F5" }}
    >
      <SearchInput disabled={true} />
      <div className="hidden lg:block">
        <div className="h-11" />
      </div>
    </div>
  );
};
