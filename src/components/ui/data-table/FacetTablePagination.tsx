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
import { cn } from "~/lib/utils";

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
    <div
      data-slot="facet-table-pagination"
      className={cn(
        "border-border/30 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between text-xs",
        className
      )}
    >
      {/* ─── Results summary & Page size selector ─────────────────── */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="text-foreground font-semibold">{startItem}</strong> to{" "}
          <strong className="text-foreground font-semibold">{endItem}</strong> of{" "}
          <strong className="text-foreground font-semibold">{totalItems.toLocaleString()}</strong> results
        </span>

        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/40">
            <span className="text-[11px]">Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger className="border-border/40 bg-background/50 h-7 w-16 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ─── Navigation Buttons ───────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="border-border/40 bg-card/60 hover:bg-muted text-foreground h-8 w-8 p-0 rounded-lg active:scale-95 transition-all"
            aria-label="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              const isCurrent = currentPage === p;
              const prevPage = pages[idx - 1];
              const showEllipsis = prevPage && p - prevPage > 1;

              return (
                <React.Fragment key={p}>
                  {showEllipsis && (
                    <span className="text-muted-foreground/60 px-1 text-xs select-none">…</span>
                  )}
                  <Button
                    type="button"
                    variant={isCurrent ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(p)}
                    className={cn(
                      "h-8 min-w-8 px-2 text-xs font-semibold rounded-lg active:scale-95 transition-all",
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border-border/40 bg-card/60 hover:bg-muted text-foreground"
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
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="border-border/40 bg-card/60 hover:bg-muted text-foreground h-8 w-8 p-0 rounded-lg active:scale-95 transition-all"
            aria-label="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
