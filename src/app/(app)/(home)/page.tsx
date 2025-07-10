export default function Home() {
  return <div>Home</div>;
}

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
