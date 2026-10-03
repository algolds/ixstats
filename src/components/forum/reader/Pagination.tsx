"use client";
// Forum pagination component.

import { NavArrowLeft as ChevronLeft, NavArrowRight as ChevronRight } from "iconoir-react";
import { Button } from "~/components/ui/button";

interface PaginationProps {
  currentPage: number;
  lastPage: number;
  onPageChange: (page: number) => void;
}

export function ForumPagination({ currentPage, lastPage, onPageChange }: PaginationProps) {
  if (lastPage <= 1) return null;

  // Build page numbers to show
  const pages: (number | "ellipsis")[] = [];
  const delta = 2;

  for (let i = 1; i <= lastPage; i++) {
    if (i === 1 || i === lastPage || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <div className="forum-pagination">
      <Button
        variant="secondary"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((page, idx) =>
        page === "ellipsis" ? (
          <span key={`e-${idx}`} className="text-label-secondary px-1">
            ...
          </span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "secondary"}
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
            className="min-w-(--control-height) px-2 tabular-nums"
          >
            {page}
          </Button>
        )
      )}

      <Button
        variant="secondary"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= lastPage}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
