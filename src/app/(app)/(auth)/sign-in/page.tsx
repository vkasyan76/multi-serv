import { SignIn } from "@clerk/nextjs";
import { caller } from "@/trpc/server";
import { redirect } from "next/navigation";

// pre-deployment: server-side rendering
export const dynamic = "force-dynamic";

const Page = async () => {
  // Disable the sign-in page if you are logged in:
  const session = await caller.auth.session();
  if (session.user) {
    redirect("/");
  }

  // Clerk-managed sign-in page; legacy payload form is intentionally bypassed.
  // Supports redirect_url from guarded pages (e.g. /orders, /dashboard).
  return <SignIn routing="path" path="/sign-in" />;
};

export default Page;
