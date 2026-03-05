import { SignUp } from "@clerk/nextjs";
import { caller } from "@/trpc/server";
import { redirect } from "next/navigation";

// pre-deployment: server-side rendering
export const dynamic = "force-dynamic";

const Page = async ({
  params,
}: {
  params: Promise<{ lang: string }>;
}) => {
  const { lang } = await params;

  // Disable the sign-up page if you are logged in:
  const session = await caller.auth.session();
  if (session.user) {
    redirect(`/${lang}`);
  }
  // Clerk-managed sign-up page; legacy payload form is intentionally bypassed.
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <SignUp routing="path" path={`/${lang}/sign-up`} />
    </div>
  );
};

export default Page;
