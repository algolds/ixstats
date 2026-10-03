"use client";

import * as React from "react";

import { cn } from "~/lib/utils/cn";

type CardVariant = "default" | "inset" | "hero";
type CardPadding = "none" | "sm" | "md" | "lg";

const VARIANT: Record<CardVariant, string> = {
  default: "bg-surface text-label border-separator rounded-card shadow-card border",
  inset: "bg-surface-secondary text-label rounded-row",
  hero: "material-hero text-label rounded-card",
};

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

const INSET_PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-4 md:p-5",
};

const INTERACTIVE =
  "facet-press facet-lift pointer-coarse:min-h-11 cursor-pointer select-none focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `default` is the opaque card, `inset` a panel inside one, `hero` the glass hero. */
  variant?: CardVariant;
  /** Default: none. Inset: `md`. */
  padding?: CardPadding;
  /** Pressable: press and lift feedback; with `onClick` it is also a keyboard-operable button. */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { variant = "default", padding, interactive = false, className, onClick, onKeyDown, ...props },
    ref
  ) => {
    const isButton = interactive && Boolean(onClick);
    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> | undefined = isButton
      ? (event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }
      : onKeyDown;
    return (
      <div
        ref={ref}
        data-slot="card"
        {...(isButton ? { role: "button", tabIndex: 0 } : {})}
        className={cn(
          "relative",
          VARIANT[variant],
          variant === "inset" ? INSET_PADDING[padding ?? "md"] : PADDING[padding ?? "none"],
          interactive && INTERACTIVE,
          className
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1 px-6 [.border-b]:pb-6", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-headline leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-body text-label-secondary", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
