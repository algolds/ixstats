import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils/cn";

/** A short label above a value or heading. Renders a `<span>`; pass `className="block"` where it replaces a block element. */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-eyebrow text-label-secondary", className)} {...props} />;
}
