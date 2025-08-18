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
  const trpc = useTRPC();
  const session = useQuery(trpc.auth.session.queryOptions());
  const user = session.data?.user;

  const isAdmin = user?.roles?.includes("super-admin");
  const hasTenant = !!user?.tenants?.length;

  const { signOut } = useClerk();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 transition-none">
        <SheetHeader className="p-4 border-b pr-12">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex flex-col overflow-y-auto h-full pb-2">
          {items.map((item) => (
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
              <SignInButton mode="modal" forceRedirectUrl="/">
                <button
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                  type="button"
                >
                  Log in
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  Admin panel
                </Link>
              )}

              {/* Profile - always visible for authenticated users */}
              <Link
                href="/profile"
                className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                onClick={() => onOpenChange(false)}
              >
                Profile
              </Link>

              {/* Dashboard OR Start Business - conditional based on tenant status */}
              {hasTenant ? (
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
              )}
              {/* Clerk SignOutButton does not accept custom onClick handlers -> const { signOut } = useClerk(); */}
              <div className="border-t">
                {/* <SignOutButton redirectUrl="/">
                  <button
                    className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                    type="button"
                  >
                    Sign out
                  </button>
                </SignOutButton> */}
                <button
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onOpenChange(false);
                  }}
                >
                  Sign out
                </button>
              </div>
            </SignedIn>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
