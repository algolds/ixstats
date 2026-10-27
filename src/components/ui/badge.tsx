import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils/cn";

/**
 * Each pair is the status colour's `-ink` on a 15% fill of itself (AA for 12px text on every
 * background role in both themes); `secondary` is the app tint's ink on the tint fill.
 */
export const badgeTones = {
  default: "bg-fill-3 text-label-secondary",
  secondary: "bg-tint-fill text-tint-ink",
  success: "bg-success/15 text-success-ink",
  warning: "bg-warning/15 text-warning-ink",
  destructive: "bg-destructive/15 text-destructive-ink",
  info: "bg-info/15 text-info-ink",
} as const;

export type BadgeTone = keyof typeof badgeTones;

/** Status and count chips in `text-caption`. Colour never carries meaning alone: pair it with text or an icon. */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 whitespace-nowrap text-caption tabular-nums",
    "transition-[color,background-color,border-color,opacity] duration-150",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
    "[:where(&)>svg]:size-3.5 [&>svg]:pointer-events-none [a&]:no-underline [a&]:hover:opacity-80",
  ].join(" "),
  {
    variants: {
      variant: {
        ...badgeTones,
        outline: "border-separator bg-transparent text-label-secondary [a&]:hover:bg-fill-4",
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
