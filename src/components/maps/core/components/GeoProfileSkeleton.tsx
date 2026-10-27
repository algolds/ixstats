import { Skeleton } from "~/components/ui/skeleton";

export function GeoProfileSkeleton() {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading geography">
      <Skeleton className="rounded-control h-24 w-full" />
      <Skeleton className="h-4 w-2/3 rounded-xs" />
      <Skeleton className="h-4 w-1/2 rounded-xs" />
    </div>
  );
}
