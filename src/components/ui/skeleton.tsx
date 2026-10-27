import type * as React from "react";
import { cn } from "~/lib/utils/cn";

/**
 * Loading placeholder: a `fill-3` block shaped like the final layout, with a subtle opacity
 * pulse that stops under Reduce Motion. No blur or filter transitions.
 */
function Skeleton({
  as: Tag = "div",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  /** `span` where the placeholder sits inside phrasing content (a row subtitle, a stat value). */
  as?: "div" | "span";
}) {
  return (
    <Tag
      data-slot="skeleton"
      className={cn(
        "bg-fill-3 rounded-control-sm animate-pulse motion-reduce:animate-none",
        Tag === "span" && "block",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
