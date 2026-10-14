import type { ComponentProps } from "react";
import { cn } from "~/lib/utils/cn";

/** A tinted decorative icon in a small well: the mark on a statement row or a Your Vault row. */
export function IconWell({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn(
        "facet-well rounded-row text-tint flex size-8 shrink-0 items-center justify-center [&_svg]:size-4",
        className
      )}
      {...props}
    />
  );
}
