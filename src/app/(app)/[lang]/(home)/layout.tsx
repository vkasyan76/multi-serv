// import configPromise from "@payload-config";
// import { getPayload } from "payload";
// import { Category } from "@/payload-types";

import { Footer } from "@/modules/home/ui/components/footer";
import { Navbar } from "@/modules/home/ui/components/navbar";

// //  fix for most projects using Clerk, Next.js App Router, and dynamic session UI.
// Clerk can do its server-side/session stuff at runtime, when all required context is present.

export const dynamic = "force-dynamic";

interface Props {
  children: React.ReactNode;
}

const Layout = async ({ children }: Props) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 bg-[#F4F4F0]"> {children}</div>
      <Footer />
    </div>
  );
};

export default Layout;
