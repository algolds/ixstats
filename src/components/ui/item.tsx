import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const itemVariants = cva(
  "group relative flex items-center justify-between gap-3 rounded-lg border transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-transparent hover:bg-muted/50",
        outline: "border-border/60 bg-card/60 shadow-xs",
        muted: "border-transparent bg-muted/40",
      },
      size: {
        default: "p-2.5",
        sm: "p-2 text-xs",
        lg: "p-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof itemVariants> {}

export function Item({ className, variant, size, children, ...props }: ItemProps) {
  return (
    <div className={cn(itemVariants({ variant, size }), className)} {...props}>
      {children}
    </div>
  );
}

export function ItemMedia({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center", className)} {...props}>
      {children}
    </div>
  );
}

export function ItemContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)} {...props}>
      {children}
    </div>
  );
}

export function ItemTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn("truncate text-xs font-medium text-foreground", className)} {...props}>
      {children}
    </h5>
  );
}

export function ItemDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("truncate text-[11px] text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function ItemActions({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}
