import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils/cn";

const neutral = "bg-fill-3 text-label-secondary [a&]:hover:bg-fill-2";
const tinted = "bg-tint-fill text-tint [a&]:hover:bg-tint/20";

/**
 * Facet 3 Badge (spec §7.1): status and count chips in `text-caption`, fully rounded.
 *
 * Variants: `neutral` (fill-3) · `tinted` (tint @ fill) · one per status role — `success`,
 * `warning`, `caution`, `destructive`, `info` — as the system colour on a 15% fill of itself ·
 * `outline` (hairline, no fill). Legacy aliases: `default`→tinted, `secondary`→neutral.
 * Colour never carries meaning alone (§10): pair status badges with text or an icon.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 whitespace-nowrap text-caption",
    "transition-[color,background-color,border-color,box-shadow] duration-150",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
    "[:where(&)>svg]:size-3.5 [&>svg]:pointer-events-none [a&]:no-underline",
  ].join(" "),
  {
    variants: {
      variant: {
        neutral,
        tinted,
        success: "bg-success/15 text-success [a&]:hover:bg-success/25",
        warning: "bg-warning/15 text-warning [a&]:hover:bg-warning/25",
        caution: "bg-caution/15 text-caution [a&]:hover:bg-caution/25",
        destructive: "bg-destructive/15 text-destructive [a&]:hover:bg-destructive/25",
        info: "bg-info/15 text-info [a&]:hover:bg-info/25",
        outline: "border-separator bg-transparent text-label-secondary [a&]:hover:bg-fill-4",
        // Legacy aliases
        default: tinted,
        secondary: neutral,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant ?? "default"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
