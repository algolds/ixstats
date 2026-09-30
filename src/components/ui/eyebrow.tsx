import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils/cn";

/**
 * The uppercase data label above a value (§0 decision 14, §3 `Eyebrow`) — short data labels only.
 * Section and list headers are sentence case (`text-subhead`), not Eyebrows.
 * Renders a `<span>`; pass `className="block"` where it replaces a block element.
 */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    // `uppercase` is repeated so a size override in `className` (which replaces `text-eyebrow`)
    // keeps the data-label casing.
    <span className={cn("text-eyebrow text-label-secondary uppercase", className)} {...props} />
  );
}
