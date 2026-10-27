"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";

type CardVariant = "pane" | "well";
type CardPadding = "none" | "sm" | "md" | "lg";
export type ContentType =
  | "prose"
  | "data"
  | "visualization"
  | "entity"
  | "collectible"
  | "input"
  | "feed"
  | "signal"
  | "navigation"
  | "transient"
  | "reveal";

const VARIANT: Record<CardVariant, string> = {
  pane: "facet-pane text-label rounded-card",
  well: "facet-well text-label rounded-row",
};

const PADDING: Record<CardVariant, Record<CardPadding, string>> = {
  pane: { none: "", sm: "p-3", md: "p-4 md:p-5", lg: "p-5 md:p-6" },
  well: { none: "", sm: "p-3", md: "p-4", lg: "p-4 md:p-5" },
};

const DEFAULT_PADDING: Record<CardVariant, CardPadding> = { pane: "none", well: "md" };

const INTERACTIVE =
  "facet-press facet-lift pointer-coarse:min-h-11 cursor-pointer select-none focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2";

/** True inside a Card: a nested Card renders as a well so glass never sits on glass. */
const InsideCard = React.createContext(false);

/** Overlays (Dialog, Sheet, Popover) are their own surface: Cards inside start as panes again. */
export function SurfaceReset({ children }: { children: React.ReactNode }) {
  return <InsideCard.Provider value={false}>{children}</InsideCard.Provider>;
}

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "content"> {
  /** `pane` (glass content card) at top level, `well` (solid inset) inside another Card. */
  variant?: CardVariant;
  /** Default: none for a pane, `md` for a well. */
  padding?: CardPadding;
  /** The content type; sets `data-content`, which scopes that type's standards. */
  content?: ContentType;
  /** Pressable: press and lift feedback; with `onClick` it is also a keyboard-operable button. */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant,
      padding,
      content,
      interactive = false,
      className,
      onClick,
      onKeyDown,
      children,
      ...props
    },
    ref
  ) => {
    const nested = React.useContext(InsideCard);
    const resolved: CardVariant = variant ?? (nested ? "well" : "pane");
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
        data-variant={resolved}
        data-content={content}
        {...(isButton ? { role: "button", tabIndex: 0 } : {})}
        className={cn(
          "relative",
          VARIANT[resolved],
          PADDING[resolved][padding ?? DEFAULT_PADDING[resolved]],
          interactive && INTERACTIVE,
          className
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <InsideCard.Provider value>{children}</InsideCard.Provider>
      </div>
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

function CardTitle({
  className,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & { icon?: React.ReactNode }) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-headline flex items-center gap-2 leading-none", className)}
      {...props}
    >
      {icon != null && (
        <span aria-hidden="true" className="text-tint inline-flex shrink-0 [:where(&)_svg]:size-4">
          {icon}
        </span>
      )}
      {children}
    </div>
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
