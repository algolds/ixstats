"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { pageWindow } from "~/lib/thinkpages-forum/pagination";
import { MAX_PAGE } from "~/lib/thinkpages-forum/paging";

/** `basePath` on page `page`, keeping any query it already carries. */
export function pageHref(basePath: string, page: number): string {
  return `${basePath}${basePath.includes("?") ? "&" : "?"}page=${page}`;
}

interface PaginationProps {
  page: number;
  last: number;
  hrefFor: (page: number) => string;
  /** Where the page sits in the list, e.g. "Posts 21-40 of 87"; shown from `sm` up. */
  summary?: string;
}

interface StepProps {
  label: "Previous" | "Next";
  target: number;
  disabled: boolean;
  hrefFor: (page: number) => string;
}

/** Previous or Next: a link, or a disabled button at the end of the list. */
function Step({ label, target, disabled, hrefFor }: StepProps) {
  if (disabled) {
    return (
      <Button variant="secondary" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={hrefFor(target)}>{label}</Link>
    </Button>
  );
}

/**
 * Page links for forum lists (real links: ctrl-click, crawlers). From `sm` up a wrapping row of the page window with
 * Previous / Next and a Latest link; below `sm` only Previous / "Page 3 of 9" / Next. CSS picks the row, so both
 * are in the markup.
 */
export function Pagination({ page, last, hrefFor, summary }: PaginationProps) {
  if (last <= 1) return null;
  const current = Math.min(Math.max(1, page), last);
  const previous = <Step label="Previous" target={current - 1} disabled={current === 1} hrefFor={hrefFor} />;
  const next = <Step label="Next" target={current + 1} disabled={current === last} hrefFor={hrefFor} />;
  return (
    <nav aria-label="Pagination" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {summary != null && <p className="text-callout text-label-secondary hidden sm:block">{summary}</p>}
      <div className="hidden flex-wrap items-center gap-1 sm:flex">
        {previous}
        {pageWindow(current, last).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} aria-hidden className="text-label-secondary px-1">
              …
            </span>
          ) : (
            <Button
              key={entry}
              asChild
              variant={entry === current ? "secondary" : "ghost"}
              size="sm"
              className="tabular-nums"
            >
              <Link href={hrefFor(entry)} aria-current={entry === current ? "page" : undefined}>
                {entry}
              </Link>
            </Button>
          )
        )}
        {next}
        {current < last && (
          <Button asChild variant="ghost" size="sm">
            <Link href={hrefFor(last)}>Latest</Link>
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 sm:hidden">
        {previous}
        <span className="text-callout text-label-secondary tabular-nums">
          Page {current} of {last}
        </span>
        {next}
      </div>
    </nav>
  );
}

/**
 * A `?page=` past the end of a non-empty list replaces the URL with the last page. Returns true
 * while that redirect is pending, so the caller shows a loader instead of an empty page.
 */
export function useLastPageRedirect(
  basePath: string,
  page: number,
  total: number | undefined,
  totalPages: number
): boolean {
  const router = useRouter();
  const last = Math.min(totalPages, MAX_PAGE);
  const past = total !== undefined && total > 0 && page > last;
  useEffect(() => {
    if (past) router.replace(pageHref(basePath, last));
  }, [past, basePath, last, router]);
  return past;
}
