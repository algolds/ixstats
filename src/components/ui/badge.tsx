import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils/cn";
import { isNumericText } from "~/lib/design/identity";

const neutral = "bg-fill-3 text-label-secondary [a&]:hover:bg-fill-2";
const tinted = "bg-tint-fill text-tint [a&]:hover:bg-tint/20";

/**
 * System-colour tinted fills: the colour's `-ink` (the hue pulled 20% toward the label) on a 15%
 * fill of the colour — ≥ 4.5:1 on every background role in both themes (token-contrast.test.ts).
 * Written out in full so Tailwind sees every class.
 */
export const SYSTEM_TINTED = {
  red: "bg-red/15 text-red-ink [a&]:hover:bg-red/25",
  orange: "bg-orange/15 text-orange-ink [a&]:hover:bg-orange/25",
  yellow: "bg-yellow/15 text-yellow-ink [a&]:hover:bg-yellow/25",
  green: "bg-green/15 text-green-ink [a&]:hover:bg-green/25",
  mint: "bg-mint/15 text-mint-ink [a&]:hover:bg-mint/25",
  teal: "bg-teal/15 text-teal-ink [a&]:hover:bg-teal/25",
  cyan: "bg-cyan/15 text-cyan-ink [a&]:hover:bg-cyan/25",
  blue: "bg-blue/15 text-blue-ink [a&]:hover:bg-blue/25",
  indigo: "bg-indigo/15 text-indigo-ink [a&]:hover:bg-indigo/25",
  purple: "bg-purple/15 text-purple-ink [a&]:hover:bg-purple/25",
  pink: "bg-pink/15 text-pink-ink [a&]:hover:bg-pink/25",
  brown: "bg-brown/15 text-brown-ink [a&]:hover:bg-brown/25",
  gray: "bg-gray/15 text-gray-ink [a&]:hover:bg-gray/25",
} as const;

export type SystemTintedColor = keyof typeof SYSTEM_TINTED;

/**
 * Facet 3 Badge (spec §7.1): status and count chips in `text-caption`, fully rounded.
 *
 * Variants: `neutral` (fill-3) · `tinted` (tint @ fill) · one per status role — `success`,
 * `warning`, `caution`, `destructive`, `info` — as the status colour's `-ink` on a 15% fill of itself ·
 * `outline` (hairline, no fill) · one per system colour — `red`, `orange`, `yellow`, `green`,
 * `mint`, `teal`, `cyan`, `blue`, `indigo`, `purple`, `pink`, `brown`, `gray` — as the colour's
 * `-ink` on a 15% fill (AA for 12px text; use these for categories, rarities and tags).
 * Legacy aliases: `default`→tinted, `secondary`→neutral.
 * Colour never carries meaning alone (§10): pair status badges with text or an icon.
 *
 * Facet 3.1: a count badge — children that are a number or a figure such as "12" / "+3" /
 * "1.2K" — is set in the data face (`font-data`: mono, tabular, slashed zero). `numeric` forces it
 * on (a count inside other markup) or off.
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
        success: "bg-success/15 text-success-ink [a&]:hover:bg-success/25",
        warning: "bg-warning/15 text-warning-ink [a&]:hover:bg-warning/25",
        caution: "bg-caution/15 text-caution-ink [a&]:hover:bg-caution/25",
        destructive: "bg-destructive/15 text-destructive-ink [a&]:hover:bg-destructive/25",
        info: "bg-info/15 text-info-ink [a&]:hover:bg-info/25",
        outline: "border-separator bg-transparent text-label-secondary [a&]:hover:bg-fill-4",
        ...SYSTEM_TINTED,
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
  numeric,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Count badge: the data face. Default: on when the children are a figure. */
    numeric?: boolean;
  }) {
  const count = numeric ?? isNumericText(props.children);
  return (
    <span
      data-slot="badge"
      data-variant={variant ?? "default"}
      data-numeric={count || undefined}
      className={cn(badgeVariants({ variant }), count && "font-data tabular-nums", className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
