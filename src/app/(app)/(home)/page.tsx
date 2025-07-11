// export default function Home() {
//   return <div>Home</div>;
// }

// auth testing:

"use client";

import { useTRPC } from "@/trpc/client";
// import { useSuspenseQuery } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const trpc = useTRPC();

  const { data } = useQuery(trpc.auth.session.queryOptions());

  return <div>{JSON.stringify(data?.user, null, 2)}</div>;
}

// Client Version for testing purposes:

// "use client";

// import { useQuery } from "@tanstack/react-query";
// import { useTRPC } from "@/trpc/client";

// export default function Home() {
//   const trpc = useTRPC();
//   const categories = useQuery(trpc.categories.getMany.queryOptions());

//   return (
//     <div>
//       <p>is loading: {`${categories.isLoading}`}</p>
//       {JSON.stringify(categories.data, null, 2)}
//     </div>
//   );
// }

// import { getQueryClient, trpc } from "@/trpc/server";

// export default async function Home() {
//   const queryClient = getQueryClient();
//   const categories = await queryClient.fetchQuery(
//     trpc.categories.getMany.queryOptions()
//   );

//   return (
//     <div className="flex flex-col min-h-screen">
//       Home Page
//       {JSON.stringify(categories, null, 2)}
//     </div>
//   );
// }
