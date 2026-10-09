"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pagination as PageControl } from "~/components/ui/pagination";
import { MAX_PAGE } from "~/lib/thinkpages-forum/paging";

/** `basePath` on page `page`, keeping any query it already carries. */
function pageHref(basePath: string, page: number): string {
  return `${basePath}${basePath.includes("?") ? "&" : "?"}page=${page}`;
}

interface PaginationProps {
  /** The page's path, e.g. `/thinkpages/c/general`; a query it carries is kept (`/thinkpages/mod?tab=bans`). */
  basePath: string;
  page: number;
  totalPages: number;
}

/** Page links for forum lists (U8: real links); the page lives in `?page=` so it survives reloads and shares. */
export function Pagination({ basePath, page, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <PageControl
      totalPages={totalPages}
      currentPage={Math.min(page, totalPages)}
      hrefOf={(next) => pageHref(basePath, next)}
    />
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
