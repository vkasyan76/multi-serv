"use client";

import { Input } from "@/components/ui/input";
import { BookmarkCheckIcon, ListFilterIcon, SearchIcon } from "lucide-react";
// import { CustomCategory } from "../types";
// import { CategoriesSidebar } from "./categories-sidebar";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
// import { useTRPC } from "@/trpc/client";
// import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CustomCategory } from "../types";
import { CategoriesSidebar } from "./categories-sidebar";

interface Props {
  disabled?: boolean;
  data: CustomCategory[];
  defaultValue?: string | undefined;
  onChange?: (value: string) => void;
}

export const SearchInput = ({
  disabled,
  data,
  defaultValue,
  onChange,
}: Props) => {
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
        data={data}
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      />
      <div className="relative w-full">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
        <Input
          className="pl-8"
          placeholder="Search services and providers"
          disabled={disabled}
        />
      </div>
      {/* categories view all button */}
      <Button
        variant="elevated"
        className="size-12 shrink-0 flex lg:hidden"
        onClick={() => setIsSidebarOpen(true)}
      >
        <ListFilterIcon className="size-4" />
      </Button>
      {/* TODO: Add library button */}
    </div>
  );
};
