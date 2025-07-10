"use client";

// import { Category } from "@/payload-types";
// import { CustomCategory } from "../types";
import { Categories } from "./categories";
import { SearchInput } from "./search-input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

// interface Props {
//   data: CustomCategory[];
//   // data: any;
//   // data: Category[];
// }

export const SearchFilters = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.categories.getMany.queryOptions());

  // TODO: make the backgroundclor in the style dynamic depending on the category to which we are redirected
  return (
    <div
      className="px-4 lg:px-12 py-8 border-b flex flex-col gap-4 w-full"
      style={{ backgroundColor: "#F5F5F5" }}
    >
      {/* {JSON.stringify(data, null, 2)} */}
      {/* <SearchInput data={data} /> */}
      {/* We don’t need to pass data to SearchInput - category sidebar fetches the data independently */}
      <SearchInput />
      {/* Hide Categories on Mobile */}
      <div className="hidden lg:block">
        <Categories data={data} />
      </div>
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
