import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

/** Placeholder tiles for a Vexel grid that is still fetching; `message` names what is loading. */
export function LoadingBlock({
  message,
  count = 8,
  className,
}: {
  message: string;
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={message}
      className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="rounded-card aspect-square w-full" />
      ))}
    </div>
  );
}
