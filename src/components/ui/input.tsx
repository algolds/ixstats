import * as React from "react";

import { cn } from "~/lib/utils/cn";

/**
 * Shared field styling: `fill-3` background with a hairline, `rounded-control`, no blur
 * or refraction; 2px tint focus ring; system red when `aria-invalid`. 16px text below `md` so iOS
 * does not zoom on focus, `text-body` above.
 */
export const fieldStyles = [
  "border border-separator bg-fill-3 text-label placeholder:text-label-tertiary",
  "selection:bg-tint selection:text-on-tint",
  "transition-[color,background-color,border-color,box-shadow] duration-150 ease-out-facet",
  "hover:bg-fill-2",
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
  "aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-fill-3",
].join(" ");

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldStyles,
        "rounded-control md:text-body flex h-(--control-height) w-full min-w-0 px-3 py-1 text-base",
        "file:text-body file:text-label file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium",
        className
      )}
      {...props}
    />
  );
}

export { Input };
