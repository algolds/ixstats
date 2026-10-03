"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ClockRotateRight as History,
  Link as Link2,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";

/** Quick detail views from the article toolbar (spec §7.3: a detail view is a `Sheet`). */
function QuickSheet({
  icon,
  title,
  onClose,
  footer,
  children,
}: {
  icon: ReactNode;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined} className="flex flex-col gap-4 sm:max-w-sm">
        <SheetTitle className="text-title-3 flex items-center gap-2 pr-8">
          {icon}
          {title}
        </SheetTitle>
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="border-separator border-t pt-3">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2 px-2" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="rounded-control h-10 w-full" />
      ))}
    </div>
  );
}

export function QuickHistoryModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = api.wikios.getHistory.useQuery(
    { title, limit: 10 },
    { staleTime: 30_000 }
  );

  const revisions = data?.revisions ?? [];

  return (
    <QuickSheet
      icon={<History className="text-tint size-5" aria-hidden="true" />}
      title="Recent History"
      onClose={onClose}
      footer={
        <Button asChild variant="ghost" size="sm">
          <Link href={withBasePath(`/wiki/history/${slug}`)} onClick={onClose}>
            <ExternalLink aria-hidden="true" />
            View full history
          </Link>
        </Button>
      }
    >
      {isLoading && <LoadingRows />}
      <ul className="divide-separator divide-y">
        {revisions.map((rev, idx) => {
          const prevRev = revisions[idx + 1];
          const sizeChange = prevRev ? rev.size - prevRev.size : rev.size;
          return (
            <li key={rev.revid} className="space-y-0.5 px-2 py-2">
              <div className="text-footnote flex items-center gap-2">
                <span className="text-label-secondary tabular-nums">
                  {new Date(rev.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-label min-w-0 truncate font-medium">{rev.user}</span>
                <span
                  className={cn(
                    "ml-auto tabular-nums",
                    sizeChange > 0
                      ? "text-green"
                      : sizeChange < 0
                        ? "text-red"
                        : "text-label-secondary"
                  )}
                >
                  {sizeChange > 0 ? "+" : ""}
                  {sizeChange.toLocaleString()}
                </span>
                {rev.minor && (
                  <span className="text-caption text-label-secondary" title="Minor edit">
                    m
                  </span>
                )}
              </div>
              {rev.comment && (
                <p className="text-footnote text-label-secondary line-clamp-2">{rev.comment}</p>
              )}
            </li>
          );
        })}
      </ul>
    </QuickSheet>
  );
}

export function QuickBacklinksModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = api.wikios.getBacklinks.useQuery(
    { title, limit: 20 },
    { staleTime: 60_000 }
  );

  const links = data?.links ?? [];

  return (
    <QuickSheet
      icon={<Link2 className="text-tint size-5" aria-hidden="true" />}
      title="What Links Here"
      onClose={onClose}
      footer={
        <Button asChild variant="ghost" size="sm">
          <Link href={withBasePath(`/wiki/whatlinkshere/${slug}`)} onClick={onClose}>
            <ExternalLink aria-hidden="true" />
            View all backlinks
          </Link>
        </Button>
      }
    >
      {isLoading && <LoadingRows />}
      {links.length === 0 && !isLoading && (
        <p className="text-callout text-label-secondary px-2 py-6 text-center">
          No pages link to this article.
        </p>
      )}
      <ul>
        {links.map((link: { title: string }, i: number) => (
          <li key={`${link.title}-${i}`}>
            <Link
              href={withBasePath(`/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
              className="rounded-control text-body text-tint duration-fast hover:bg-fill-4 block truncate px-2 py-2 transition-colors"
              onClick={onClose}
            >
              {link.title.replace(/_/g, " ")}
            </Link>
          </li>
        ))}
      </ul>
    </QuickSheet>
  );
}
