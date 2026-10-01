import * as React from "react";

import { cn } from "~/lib/utils/cn";
import { FACET_CARD_SURFACE } from "~/components/ui/facet-container";

/**
 * shadcn-shaped card on Facet 3 roles (§7.1): renders exactly `FacetCard`'s opaque surface
 * (`FACET_CARD_SURFACE`: `bg-surface`, `separator` hairline, `rounded-card`, `shadow-card`) with
 * the shadcn layout (24px vertical rhythm, `CardHeader/Title/Description/Action/Content/Footer`).
 *
 * @deprecated Duplicates `FacetCard`. New code uses `FacetCard` (+ `FacetCardHeader/Content/
 * Footer`) from `~/components/ui/facet-container`; existing `Card` call sites keep working.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(FACET_CARD_SURFACE, "flex flex-col gap-6 py-6", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
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

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
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

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
