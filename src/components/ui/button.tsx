import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils/cn";

/** 2px tint outline with a 2px offset; an outline so it never fights a box-shadow. */
export const focusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint";

/** 44x44 minimum hit area on coarse pointers via an invisible `::after`; the control must be `relative`. */
export const hitSlop =
  "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2";

const buttonVariants = cva(
  [
    "relative inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap select-none",
    "duration-fast ease-out-facet transition-colors",
    focusRing,
    hitSlop,
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [:where(&)_svg]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-separator bg-transparent text-label hover:bg-fill-4 active:bg-fill-3",
        secondary: "bg-fill-3 text-label hover:bg-fill-2 active:bg-fill",
        ghost: "bg-transparent text-label hover:bg-fill-4 active:bg-fill-3",
        link: "bg-transparent text-tint underline-offset-4 hover:underline active:opacity-70",
      },
      size: {
        default: "h-(--control-height) rounded-control px-4 text-body font-medium",
        xs: "h-6 gap-1 rounded-control-sm px-2 text-caption font-medium",
        sm: "h-(--control-height-sm) gap-1 rounded-control-sm px-3 text-footnote font-medium",
        lg: "h-(--control-height-lg) rounded-control-lg px-5 text-body font-medium",
        icon: "size-(--control-height) rounded-control",
        "icon-sm": "size-(--control-height-sm) rounded-control-sm",
        "icon-lg": "size-(--control-height-lg) rounded-control-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
