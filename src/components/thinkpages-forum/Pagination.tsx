"use client";

import { useRouter } from "next/navigation";
import { Pagination as PageControl } from "~/components/ui/pagination";

interface PaginationProps {
  /** The page's path without a query, e.g. `/thinkpages/c/general`. */
  basePath: string;
  page: number;
  totalPages: number;
}

/** Page links for forum lists; the page lives in `?page=` so it survives reloads and shares. */
export function Pagination({ basePath, page, totalPages }: PaginationProps) {
  const router = useRouter();
  if (totalPages <= 1) return null;
  return (
    <PageControl
      totalPages={totalPages}
      currentPage={Math.min(page, totalPages)}
      onPageChangeAction={(next) => router.push(`${basePath}?page=${next}`)}
    />
  );
}
