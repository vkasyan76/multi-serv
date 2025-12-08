"use client";

import { Input } from "@/components/ui/input";
import { BookmarkCheckIcon, ListFilterIcon, SearchIcon } from "lucide-react";
// import { CustomCategory } from "../types";
// import { CategoriesSidebar } from "./categories-sidebar";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
// import { CustomCategory } from "../types";
import { CategoriesSidebar } from "./categories-sidebar";
import { SignedIn, useAuth } from "@clerk/nextjs";

interface Props {
  disabled?: boolean;
  // data: CustomCategory[];
  defaultValue?: string | undefined;
  onChange?: (value: string) => void;
}

export const SearchInput = ({
  disabled,
  // data,
  defaultValue,
  onChange,
}: Props) => {
  const { isSignedIn } = useAuth();

  const trpc = useTRPC();

  // always refetch + don’t keep stale auth
  const session = useQuery({
    ...trpc.auth.session.queryOptions(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
  });

  // show Orders button only for users with paid/refunded orders - not “sticky”
  // show Orders button only for users with paid/refunded orders - not “sticky”
  const hasOrdersQ = useQuery({
    ...trpc.orders.hasAnyPaidMine.queryOptions(),
    enabled: isSignedIn && !!session.data?.user?.id, // <- add isSignedIn gate
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // showOrders depends on Clerk + backend answer
  const showOrders = isSignedIn && !!hasOrdersQ.data?.hasAny;

  // showOrders depend on session
  // const showOrders = !!session.data?.user?.id && !!hasOrdersQ.data?.hasAny;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchValue, setSearchValue] = useState(defaultValue || "");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange?.(searchValue); // eqzuivalent to `if (onChange) onChange(searchValue);`
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchValue, onChange]);

  return (
    <div className="flex items-center gap-2 w-full">
      <CategoriesSidebar
        // data={data}
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      />
      <div className="relative w-full">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
        <Input className="pl-8" placeholder="Search" disabled={disabled} />
      </div>
      {/* categories view all button */}
      <Button
        variant="elevated"
        className="size-12 shrink-0 flex lg:hidden"
        onClick={() => setIsSidebarOpen(true)}
      >
        <ListFilterIcon className="size-4" />
      </Button>
      {/* library button */}
      <SignedIn>
        {showOrders && (
          <Button asChild variant="elevated" className="h-12">
            <Link href="/orders">
              <BookmarkCheckIcon />
              My Orders
            </Link>
          </Button>
        )}
      </SignedIn>
    </div>
  );
};
