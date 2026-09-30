"use client";
// src/components/forum/reader/Pagination.tsx
// Forum pagination component.

import { NavArrowLeft as ChevronLeft, NavArrowRight as ChevronRight } from "iconoir-react";
import { cn } from "~/lib/utils";

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
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="forum-pagination-btn"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page, idx) =>
        page === "ellipsis" ? (
          <span key={`e-${idx}`} className="px-1 text-[var(--forum-text-dim)]">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "forum-pagination-btn",
              page === currentPage && "forum-pagination-btn-active"
            )}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= lastPage}
        className="forum-pagination-btn"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
