import { SignIn } from "@clerk/nextjs";
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

  // Disable the sign-in page if you are logged in:
  const session = await caller.auth.session();
  if (session.user) {
    redirect(`/${lang}`);
  }

  // Clerk-managed sign-in page; legacy payload form is intentionally bypassed.
  // Supports redirect_url from guarded pages (e.g. /orders, /dashboard).
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <SignIn routing="path" path={`/${lang}/sign-in`} />
    </div>
  );
};

export default Page;
