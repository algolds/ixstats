"use client";

import React from "react";
import { NavArrowLeft as ChevronLeft, NavArrowRight as ChevronRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils/cn";

interface FacetTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export function FacetTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  className,
}: FacetTablePaginationProps) {
  const pageSizeLabelId = React.useId();
  if (totalPages <= 1 && !pageSizeOptions) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  };

  const pages = getPageNumbers();

  return (
    <nav
      aria-label="Pagination"
      data-slot="facet-table-pagination"
      className={cn(
        "border-separator text-footnote flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {/* Results summary & Page size selector */}
      <div className="text-label-secondary flex flex-wrap items-center gap-3">
        <span className="tabular-nums">
          Showing <strong className="text-label font-semibold">{startItem}</strong> to{" "}
          <strong className="text-label font-semibold">{endItem}</strong> of{" "}
          <strong className="text-label font-semibold">{totalItems.toLocaleString()}</strong>{" "}
          results
        </span>

        {pageSizeOptions && onPageSizeChange && (
          <div className="border-separator flex items-center gap-2 border-l pl-2">
            <span id={pageSizeLabelId}>Per page:</span>
            <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange(Number(val))}>
              <SelectTrigger
                size="sm"
                aria-labelledby={pageSizeLabelId}
                className="w-16 tabular-nums"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="tabular-nums">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            aria-label="Previous Page"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>

          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              const isCurrent = currentPage === p;
              const prevPage = pages[idx - 1];
              const showEllipsis = prevPage && p - prevPage > 1;

              return (
                <React.Fragment key={p}>
                  {showEllipsis && (
                    <span aria-hidden="true" className="text-label-tertiary px-1 select-none">
                      …
                    </span>
                  )}
                  <Button
                    type="button"
                    variant={isCurrent ? "secondary" : "ghost"}
                    size="sm"
                    aria-current={isCurrent ? "page" : undefined}
                    aria-label={`Page ${p}`}
                    onClick={() => onPageChange(p)}
                    className={cn(
                      "min-w-(--control-height-sm) px-2 tabular-nums",
                      !isCurrent && "text-label"
                    )}
                  >
                    {p}
                  </Button>
                </React.Fragment>
              );
            })}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next Page"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}
