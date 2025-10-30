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
    <nav aria-label="Pagination" className="flex items-center space-x-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChangeAction(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        Prev
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChangeAction(p)}
        >
          {p}
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChangeAction(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </nav>
  );
}
