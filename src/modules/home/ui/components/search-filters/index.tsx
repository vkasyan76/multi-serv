// import { Category } from "@/payload-types";
import { CustomCategory } from "../types";
import { Categories } from "./categories";
import { SearchInput } from "./search-input";

interface Props {
  data: CustomCategory[];
  // data: any;
  // data: Category[];
}

export const SearchFilters = ({ data }: Props) => {
  return (
    <div className="px-4 lg:px-12 py-8 border-b flex flex-col gap-4 w-full">
      <SearchInput />
      {/* {JSON.stringify(data, null, 2)} */}
      <Categories data={data} />
    </div>
  );
};
