"use client";

import React from "react";
import { SystemRestart } from "iconoir-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";

interface GlobalBuilderLoadingProps {
  message?: string;
  className?: string;
  variant?: "full" | "compact" | "minimal";
  /** Kept for API compatibility; the Facet loader shows no decorative subsystem strip. */
  showSubsystems?: boolean;
}

/** A small spinner plus a message: the one meaningful live indicator while the builder loads. */
function LoadingLabel({ message, size = "sm" }: { message: string; size?: "sm" | "md" }) {
  return (
    <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
      <SystemRestart
        aria-hidden="true"
        className={cn("animate-spin text-amber-500", size === "md" ? "h-5 w-5" : "h-4 w-4")}
      />
      {message}
    </p>
  );
}

/**
 * GlobalBuilderLoading - route-level loading state for the builder.
 *
 * `full` renders a Facet skeleton shaped like the builder (header card and a section card);
 * `compact` a short card; `minimal` an inline spinner.
 */
export function GlobalBuilderLoading({
  message = "Building your nation...",
  className,
  variant = "full",
}: GlobalBuilderLoadingProps) {
  if (variant === "minimal") {
    return (
      <div role="status" className={cn("flex items-center gap-2", className)}>
        <LoadingLabel message={message} />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div role="status" className={cn("flex items-center justify-center p-6", className)}>
        <FacetCard depth={2} className="w-full max-w-sm space-y-3 rounded-2xl p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <LoadingLabel message={message} />
        </FacetCard>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={message}
      className={cn("flex min-h-screen w-full flex-col pt-24 sm:pt-28 lg:pt-32", className)}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-8">
        <FacetCard depth={2} className="flex items-center justify-between gap-3 rounded-2xl p-3">
          <Skeleton className="h-8 w-24" />
          <div className="hidden gap-2 sm:flex">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-8 w-28" />
        </FacetCard>
        <FacetCard depth={2} className="space-y-6 rounded-2xl p-6 sm:p-8">
          <Skeleton className="h-6 w-56" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <LoadingLabel message={message} size="md" />
        </FacetCard>
      </div>
    </div>
  );
}

/**
 * BuilderStepLoading - loading state inside a builder step (Suspense fallback).
 */
export function BuilderStepLoading({
  message = "Loading step...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn("space-y-4 p-4 sm:p-6", className)}>
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <LoadingLabel message={message} />
    </div>
  );
}

/**
 * TabLoadingFallback - loading state for a builder tab panel.
 */
export function TabLoadingFallback() {
  return (
    <div role="status" aria-label="Loading tab" className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
