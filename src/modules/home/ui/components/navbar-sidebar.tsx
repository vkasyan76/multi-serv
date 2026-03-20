"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { cn, platformHomeHref } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";
import { LanguageSwitcher } from "@/i18n/ui/language-switcher";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  // SignOutButton,
} from "@clerk/nextjs";
import { useClerk } from "@clerk/nextjs";

interface NavbarItem {
  href: string;
  children: React.ReactNode;
}

interface Props {
  items: NavbarItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NavbarSidebar = ({ items, open, onOpenChange }: Props) => {
  const t = useTranslations("common");
  const trpc = useTRPC();
  const session = useQuery(trpc.auth.session.queryOptions());
  const user = session.data?.user;
  const params = useParams<{ lang?: string }>();
  const lang = normalizeToSupported(params?.lang);

  // Keep sidebar links on the active locale segment.
  const href = (pathnameWithQuery: string) => {
    const [pathPart, query = ""] = pathnameWithQuery.split("?");
    const localizedPath = withLocalePrefix(pathPart || "/", lang);
    return query ? `${localizedPath}?${query}` : localizedPath;
  };

  const platformHref = (pathnameWithQuery: string) => {
    const localized = href(pathnameWithQuery);
    const base = platformHomeHref();
    if (!base.startsWith("http")) return localized;

    try {
      const url = new URL(base);
      if (!url.hostname || url.hostname === "undefined") return localized;
    } catch {
      return localized;
    }

    return `${base.replace(/\/+$/, "")}${localized}`;
  };

  const isAdmin = user?.roles?.includes("super-admin");
  const hasTenant = !!user?.tenants?.length;

  // Phase 6: keep mobile nav lean (longer locales) and close Sheet on language switch.
  const hiddenMobileHrefs = new Set([
    href("/about"),
    href("/features"),
    href("/pricing"),
    href("/contact"),
  ]);
  const mobileItems = items.filter((item) => !hiddenMobileHrefs.has(item.href));

  // Get info for user's tenant:
  const { data: myTenant, isLoading: isMineLoading } = useQuery({
    ...trpc.tenants.getMine.queryOptions({}),
    enabled: !!session.data?.user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const dashHref = hasTenant
    ? platformHref("/dashboard")
    : href("/profile?tab=vendor");

  // const dashHref = myTenant
  //   ? `${generateTenantUrl(myTenant.slug)}/dashboard`
  //   : "/profile?tab=vendor";

  // Only disable when session says user has a tenant but getMine hasn't returned it yet
  const isDashLoading = hasTenant && !myTenant && isMineLoading;

  const { signOut } = useClerk();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 transition-none">
        <SheetHeader className="p-4 border-b pr-12">
          <SheetTitle>{t("nav.menu")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex flex-col overflow-y-auto h-full pb-2">
          <div className="p-4 border-b">
            <LanguageSwitcher
              className="w-full"
              onNavigate={() => onOpenChange(false)}
              isAuthenticated={!!session.data?.user?.id}
            />
          </div>

          {mobileItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
              onClick={() => onOpenChange(false)}
            >
              {item.children}
            </Link>
          ))}
          {/* Clerk Auth Buttons and User Profile / Dashboard Links */}
          <div className="border-t">
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl={href("/")}>
                <button
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                  type="button"
                >
                  {t("nav.login")}
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              {isAdmin && (
                <Link
                  href={href("/dashboard/admin")}
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  {/* Admin CTA intentionally stays English because Payload admin is internal-only UI. */}
                  Admin Panel
                </Link>
              )}

              {/* Profile - always visible for authenticated users */}
              <Link
                href={href("/profile")}
                className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                onClick={() => onOpenChange(false)}
              >
                {t("nav.profile")}
              </Link>

              {/* Dashboard OR Start Business - conditional based on tenant status */}
              {/* {hasTenant ? (
                <Link
                  href="/dashboard"
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/profile?tab=vendor"
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  Start Business
                </Link>
              )} */}
              <Link
                href={dashHref}
                className={cn(
                  "w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium",
                  isDashLoading && "opacity-60",
                )}
                aria-disabled={isDashLoading}
                aria-busy={isDashLoading}
                onClick={
                  isDashLoading
                    ? (e) => e.preventDefault() // block keyboard + mouse activation
                    : () => onOpenChange(false) // current behavior when ready
                }
              >
                {hasTenant ? t("nav.dashboard") : t("nav.start_business")}
              </Link>

              {/* Clerk SignOutButton does not accept custom onClick handlers -> const { signOut } = useClerk(); */}
              <div className="border-t">
                <button
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onOpenChange(false);
                  }}
                >
                  {t("nav.logout")}
                </button>
              </div>
            </SignedIn>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
