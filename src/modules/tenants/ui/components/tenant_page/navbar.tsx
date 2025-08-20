"use client";

import { generateTenantUrl } from "@/lib/utils";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";

// import { CheckoutButton } from "@/modules/checkout/ui/components/checkout-button";

// import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ShoppingCartIcon } from "lucide-react";

// to avoid hydration error, dynamically import CheckoutButton. It won't go through server-side rendering (SSR).
// add the fallback to prevent the button from disapearing on the client side. (loading state)
// const CheckoutButton = dynamic(
//   () =>
//     import("@/modules/checkout/ui/components/checkout-button.tsx").then(
//       (mod) => mod.CheckoutButton
//     ),
//   {
//     ssr: false,
//     loading: () => (
//       <Button className=" bg-white" disabled>
//         <ShoppingCartIcon className="text-black" />
//       </Button>
//     ),
//   }
// );

interface Props {
  slug: string;
}

export const Navbar = ({ slug }: Props) => {
  const trpc = useTRPC();

  const { data } = useSuspenseQuery(trpc.tenants.getOne.queryOptions({ slug }));

  return (
    <nav className="h-16 sm:h-20 border-b font-medium bg-white">
      <div className="max-w-[var(--breakpoint-xl)] mx-auto flex justify-between items-center h-full px-3 sm:px-4 lg:px-12">
        <Link
          href={generateTenantUrl(slug)}
          className="flex items-center gap-2 min-w-0"
        >
          {data.image?.url && (
            <Image
              src={data.image.url}
              width={32}
              height={32}
              className="rounded-full border shrink-0 size-6 sm:size-8"
              alt={slug}
            />
          )}
          <p className="text-lg sm:text-xl font-semibold truncate">{data.name}</p>
        </Link>
        {/* <CheckoutButton tenantSlug={slug} hideIfEmpty /> */}
      </div>
    </nav>
  );
};

export const NavbarSkeleton = () => {
  return (
    <nav className="h-16 sm:h-20 border-b font-medium bg-white">
      <div className="max-w-[var(--breakpoint-xl)] mx-auto flex justify-between items-center h-full px-3 sm:px-4 lg:px-12">
        <div />
        {/* Skeleton for checkout button */}
        <Button className=" bg-white" disabled>
          <ShoppingCartIcon className="text-black" />
        </Button>
      </div>
    </nav>
  );
};
