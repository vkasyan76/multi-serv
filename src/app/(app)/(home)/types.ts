import { Category } from "../../../../payload-types";

export type CustomCategory = Category & {
  subcategories: Category[];
  //   subcategories: Omit<Category, "subcategories">[]; // subcategories will be a type of Category without subcategories field
};
