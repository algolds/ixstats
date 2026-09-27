import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils/cn";

/**
 * The one sanctioned Facet caption style: a small uppercase label above a value or section.
 * Renders a `<span>`; pass `className="block"` where it replaces a block element.
 */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("text-muted-foreground text-xs font-medium tracking-wide uppercase", className)}
      {...props}
    />
  );
}
