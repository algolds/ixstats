import type * as React from "react";
import { cn } from "~/lib/utils/cn";

/**
 * Loading placeholder (§7.1): a `fill-3` block shaped like the final layout, with a subtle opacity
 * pulse that stops under Reduce Motion. No blur or filter transitions.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-fill-3 rounded-control-sm animate-pulse motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
