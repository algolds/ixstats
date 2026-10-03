import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

/**
 * Loading placeholder shaped like the country editor: the header card (back
 * link, flag and name, four section tiles) and a section card of fields.
 */
export function EditorSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the country editor"
      className="flex w-full flex-1 flex-col pt-24 sm:pt-28 lg:pt-32"
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-4">
        <Card className="rounded-card flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-40" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="rounded-control h-10 w-14 sm:h-12 sm:w-[72px]" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="rounded-row h-16" />
            ))}
          </div>
        </Card>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-8">
        <Card className="rounded-card space-y-6 p-6 sm:p-8">
          <Skeleton className="h-6 w-56" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
