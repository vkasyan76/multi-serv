"use client";

import { useTRPC } from "@/trpc/client";
// import { useSuspenseQuery } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const trpc = useTRPC();

  const { data } = useQuery(trpc.auth.session.queryOptions());

  return <div>{JSON.stringify(data?.user, null, 2)}</div>;
}
