import { CardSkeleton } from "./card-skeleton";

interface ListSkeletonProps {
  count?: number;
}

export const ListSkeleton = ({ count = 6 }: ListSkeletonProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
};
