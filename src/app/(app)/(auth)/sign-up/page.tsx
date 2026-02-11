import { SignUp } from "@clerk/nextjs";
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
  // Clerk-managed sign-up page; legacy payload form is intentionally bypassed.
  return <SignUp routing="path" path="/sign-up" />;
};

export default Page;
