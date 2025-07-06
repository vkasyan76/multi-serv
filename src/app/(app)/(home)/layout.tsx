import configPromise from "@payload-config";
import { getPayload } from "payload";

import { Footer } from "@/modules/home/ui/components/footer";
import { Navbar } from "@/modules/home/ui/components/navbar";
import { SearchFilters } from "@/modules/home/ui/components/search-filters";
import { Category } from "@/payload-types";

interface Props {
  children: React.ReactNode;
}

const Layout = async ({ children }: Props) => {
  const payload = await getPayload({ config: configPromise });

  const data = await payload.find({
    collection: "categories",
    depth: 1, // Populate subcategories, subcategories.[0] will be a type of "Category"
    pagination: false, // Disable pagination to get all categories
    where: {
      parent: {
        exists: false,
      },
    },
  });

  const formatedData = data.docs.map((doc) => ({
    ...doc,
    subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
      // Because of "depth: 1" we are confident "doc" will be a type of "Category"
      ...(doc as Category),
      subcategories: undefined, // subcategories do not have own subcategories
    })),
  }));
  // console.log("Categories data:", data);
  // console.log("Formatted Categories data:", formatedData);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <SearchFilters data={formatedData} />
      <div className="flex-1 bg-[#F4F4F0]"> {children}</div>
      <Footer />
    </div>
  );
};

export default Layout;
