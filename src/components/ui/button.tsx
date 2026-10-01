import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils/cn";

/**
 * Facet 3 focus ring (spec §10): 2px tint outline with a 2px offset. An outline (not a ring) so the
 * offset gap shows whatever is behind the control and never fights a box-shadow.
 */
export const focusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint";

/**
 * 44×44 minimum hit area on coarse pointers (spec §4, §10) without changing the visual size: an
 * invisible `::after` centred on the control. The control must be `relative`.
 */
export const hitSlop =
  "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2";

/**
 * Facet 3.1: the primary role — monochrome (near-black on light, near-white on dark; v2
 * `--primary: text-primary`) everywhere, and the v2 BUILDER_GOLD gradient with a gold rim inside
 * `[data-app="mycountry"]` (MyCountry and the Builder). The tint stays for `tinted`, `plain` and
 * `link`. The classes read the `--primary-*` tokens (styles/facet/tokens.css), so a caller's
 * `bg-*` / `text-*` / `shadow-*` still merges over them deterministically (`cn`).
 */
const filled =
  "bg-primary-fill bg-(image:--primary-fill-image) text-on-primary shadow-(--primary-rim) hover:bg-primary-fill-hover hover:bg-(image:--primary-fill-image-hover) hover:shadow-(--primary-rim-hover)";
const gray = "bg-fill-3 text-label hover:bg-fill-2";
const bordered = "border border-separator bg-transparent text-label hover:bg-fill-4";
const sm = "h-(--control-height-sm) gap-1 rounded-control-sm px-3 text-footnote font-medium";

/**
 * Facet 3 Button (spec §7.2).
 *
 * Styles: `filled` (the primary role: monochrome, gold in MyCountry/Builder — one per view) ·
 * `tinted` (tint @ fill) · `gray` (fill-3) · `plain` (tint text) · `bordered` · `destructive` ·
 * `link`. Legacy names are aliases: `default`→filled, `secondary`→gray, `ghost`→plain in the
 * neutral label colour, `outline`→bordered.
 *
 * Physics (Facet 3.1): every button presses (`facet-press`, scale .98; icon sizes `.95`), and the
 * press is dropped under Reduce Motion. `facet-press` carries the colour/shadow/scale transition.
 *
 * Sizes: `sm` 28 · `md`/`default` 36 · `lg` 44 (heights follow `--control-height-*`, so Compact
 * density shrinks them) · `icon` 36² · `icon-sm` 28² · `icon-lg` 44². `xs` is an alias of `sm`.
 */
const buttonVariants = cva(
  [
    "relative inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap select-none",
    "facet-press",
    focusRing,
    hitSlop,
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [:where(&)_svg]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        filled,
        tinted: "bg-tint-fill text-tint hover:bg-tint/20",
        gray,
        plain: "bg-transparent text-tint hover:bg-fill-4",
        bordered,
        destructive: "bg-destructive text-on-destructive hover:bg-destructive/90",
        link: "bg-transparent text-tint underline-offset-4 hover:underline",
        // Legacy aliases
        default: filled,
        secondary: gray,
        ghost: "bg-transparent text-label hover:bg-fill-4",
        outline: bordered,
      },
      size: {
        sm,
        md: "h-(--control-height) rounded-control px-4 text-body font-medium",
        lg: "h-(--control-height-lg) rounded-control-lg px-5 text-body font-medium",
        icon: "facet-press-sm size-(--control-height) rounded-control",
        "icon-sm": "facet-press-sm size-(--control-height-sm) rounded-control-sm",
        "icon-lg": "facet-press-sm size-(--control-height-lg) rounded-control-lg",
        // Legacy aliases
        default: "h-(--control-height) rounded-control px-4 text-body font-medium",
        xs: sm,
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "md",
    },
  }
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantProps["variant"]>;
export type ButtonSize = NonNullable<ButtonVariantProps["size"]>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-slot="button"
        data-variant={variant ?? "filled"}
        data-size={size ?? "md"}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
