import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

/** Placeholder for the Messages pane: inbox rows on the left, the thread beside them from 1024px. */
export default function MessagesLoading() {
  return (
    <Card
      content="feed"
      className="h-[calc(100dvh-var(--shell-top-offset)-var(--shell-tabbar-height)-1rem)] min-h-112 overflow-clip lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Loading messages"
    >
      <div className="border-separator flex h-full min-w-0 flex-col lg:border-r">
        <div className="border-separator flex items-center gap-2 border-b p-4">
          <Skeleton className="rounded-control size-8" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="flex flex-col gap-1 p-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden h-full min-w-0 flex-col lg:flex">
        <div className="border-separator flex items-center gap-3 border-b p-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-4 p-4">
          <Skeleton className="rounded-row h-10 w-1/2" />
          <Skeleton className="rounded-row h-10 w-2/5 self-end" />
          <Skeleton className="rounded-row h-10 w-3/5" />
          <Skeleton className="rounded-row h-10 w-1/3 self-end" />
        </div>
        <div className="border-separator border-t p-4">
          <Skeleton className="rounded-control h-10 w-full" />
        </div>
      </div>
    </Card>
  );
}
