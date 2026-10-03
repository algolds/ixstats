"use client";

import React from "react";
import { SystemRestart } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

interface GlobalBuilderLoadingProps {
  message?: string;
  className?: string;
  variant?: "full" | "compact" | "minimal";
}

/** A small spinner plus a message: the one meaningful live indicator while the builder loads. */
function LoadingLabel({ message, size = "sm" }: { message: string; size?: "sm" | "md" }) {
  return (
    <p className="text-label-secondary text-body flex items-center justify-center gap-2">
      <SystemRestart
        aria-hidden="true"
        className={cn("text-tint animate-spin", size === "md" ? "h-5 w-5" : "h-4 w-4")}
      />
      {message}
    </p>
  );
}

/**
 * GlobalBuilderLoading - route-level loading state for the builder.
 *
 * `full` renders a skeleton shaped like the builder (header card and a section card);
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
        <Card className="rounded-card w-full max-w-sm space-y-3 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <LoadingLabel message={message} />
        </Card>
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
        <Card className="rounded-card flex items-center justify-between gap-3 p-3">
          <Skeleton className="h-8 w-24" />
          <div className="hidden gap-2 sm:flex">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-8 w-28" />
        </Card>
        <Card className="rounded-card space-y-6 p-6 sm:p-8">
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
        </Card>
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
        <Skeleton className="rounded-row h-28" />
        <Skeleton className="rounded-row h-28" />
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
        <Skeleton className="rounded-row h-32" />
        <Skeleton className="rounded-row h-32" />
      </div>
    </div>
  );
}
