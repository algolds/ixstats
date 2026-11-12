"use client";

import Link from "next/link";
import { NavArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { ContentType } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils/cn";

interface PaneProps {
  title: React.ReactNode;
  icon: React.ReactNode;
  subtitle?: React.ReactNode;
  /** The way into the full section, top right. */
  link?: { href: string; label: string };
  content?: ContentType;
  className?: string;
  /** Rendered flush (no padding), for full-bleed stages. */
  flush?: boolean;
  children: React.ReactNode;
}

/** A front page section on the shared iron-gall ink palette: icon and headline title, an optional way in, then the content. */
export function Pane({
  title,
  icon,
  subtitle,
  link,
  content,
  className,
  flush = false,
  children,
}: PaneProps) {
  return (
    <Card
      content={content}
      padding={flush ? "none" : "md"}
      className={cn("flex min-w-0 flex-col", className)}
    >
      <CardHeader
        className={cn(
          "flex-row items-start justify-between gap-3 pb-3",
          flush ? "p-4 md:p-5" : "px-0"
        )}
      >
        <div className="min-w-0">
          <CardTitle icon={icon} role="heading" aria-level={2}>
            {title}
          </CardTitle>
          {subtitle != null && <CardDescription className="mt-1">{subtitle}</CardDescription>}
        </div>
        {link && (
          <Link
            href={link.href}
            className="text-callout text-tint-ink focus-visible:outline-tint rounded-control-sm inline-flex shrink-0 items-center gap-1 font-medium focus-visible:outline-2 pointer-coarse:min-h-11"
          >
            {link.label}
            <NavArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1 px-0">{children}</CardContent>
    </Card>
  );
}

/** The slice of a tRPC query a pane needs for its states. */
export interface PaneQuery {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

interface PaneBodyProps {
  query: PaneQuery;
  /** What the pane shows, for the error line ("Couldn't load {what}."). */
  what: string;
  /** The empty line, when loaded with nothing to show; null when there is content. */
  empty: string | null;
  /** Skeleton rows while loading. */
  rows?: number;
  children: React.ReactNode;
}

/** A pane's own loading, error and empty states, so one failing source never blanks the page. */
export function PaneBody({ query, what, empty, rows = 4, children }: PaneBodyProps) {
  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label={`Loading ${what}`}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <EmptyState
        compact
        title={`Couldn't load ${what}.`}
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (empty) return <EmptyState compact title={empty} />;
  return <>{children}</>;
}
