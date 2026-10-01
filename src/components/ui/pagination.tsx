"use client";

import { Button } from "./button";

interface PaginationProps {
  totalPages: number;
  currentPage: number;
  onPageChangeAction: (page: number) => void;
}

export function Pagination({ totalPages, currentPage, onPageChangeAction }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <Button
        variant="gray"
        size="sm"
        onClick={() => onPageChangeAction(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === currentPage ? "tinted" : "ghost"}
          size="sm"
          className="tabular-nums"
          aria-current={p === currentPage ? "page" : undefined}
          onClick={() => onPageChangeAction(p)}
        >
          {p}
        </Button>
      ))}
      <Button
        variant="gray"
        size="sm"
        onClick={() => onPageChangeAction(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </nav>
  );
}
