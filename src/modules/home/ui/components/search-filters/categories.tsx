// import { Category } from "@/payload-types";
import { CustomCategory } from "../types";
import { CategoryDropdown } from "./categories-dropdown";

interface Props {
  // data: Category[];
  // data: any
  data: CustomCategory[];
}
export const Categories = ({ data }: Props) => {
  return (
    <div className="flex flex-nowrap items-center">
      {data.map((category) => (
        <div key={category.id}>
          {/* Categories: {JSON.stringify(data, null, 2)} */}
          <CategoryDropdown
            category={category}
            isActive={false}
            isNavigationHovered={false}
          />
        </div>
      ))}
    </div>
  );
};
