"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowSeparateVertical as ArrowUpDown, ArrowUp, ArrowDown, Database } from "iconoir-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils/cn";
import { FacetMobileCard } from "./FacetMobileCard";
import { FacetTableToolbar } from "./FacetTableToolbar";
import { FacetTablePagination } from "./FacetTablePagination";
import type { FacetDataTableProps, FacetColumn, SortState } from "./types";

export function FacetDataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  description,
  searchable = false,
  searchPlaceholder = "Search records...",
  searchKeys = [],
  searchValue: controlledSearchValue,
  onSearchChange: controlledOnSearchChange,

  paginated = false,
  pageSize: initialPageSize = 10,
  page: controlledPage,
  totalCount,
  onPageChange: controlledOnPageChange,
  onPageSizeChange: controlledOnPageSizeChange,
  pageSizeOptions,

  sortState: controlledSortState,
  onSortChange: controlledOnSortChange,

  layoutMode = "auto",
  loading = false,
  emptyMessage = "No data available",
  emptyIcon,

  onRowClick,
  rowClassName,
  cardClassName,

  toolbarActions,
  exportable = false,
  exportFilename = "table-export.csv",

  urlSync = false,
  urlPrefix = "",

  className,
  tableContainerClassName,
  cardContainerClassName,
}: FacetDataTableProps<T>) {
  // ─── 1. URL Sync Initialization & State ─────────────────────────
  const getInitialUrlState = () => {
    if (!urlSync || typeof window === "undefined") {
      return { search: "", page: 1, sort: null as SortState | null };
    }
    const params = new URLSearchParams(window.location.search);
    const search = params.get(`${urlPrefix}search`) || "";
    const pageNum = parseInt(params.get(`${urlPrefix}page`) || "1", 10);
    const sortCol = params.get(`${urlPrefix}sort`);
    const sortDir = params.get(`${urlPrefix}dir`) as "asc" | "desc" | null;

    return {
      search,
      page: isNaN(pageNum) || pageNum < 1 ? 1 : pageNum,
      sort: sortCol && sortDir ? { columnKey: sortCol, direction: sortDir } : null,
    };
  };

  const initialUrl = useMemo(getInitialUrlState, [urlSync, urlPrefix]);

  // Uncontrolled State fallbacks
  const [internalSearch, setInternalSearch] = useState(initialUrl.search);
  const [internalPage, setInternalPage] = useState(initialUrl.page);
  const [internalPageSize, setInternalPageSize] = useState(initialPageSize);
  const [internalSort, setInternalSort] = useState<SortState | null>(initialUrl.sort);

  // Resolved values (Controlled vs Uncontrolled)
  const isSearchControlled = controlledSearchValue !== undefined;
  const searchTerm = isSearchControlled ? controlledSearchValue : internalSearch;

  const isPageControlled = controlledPage !== undefined;
  const currentPage = isPageControlled ? controlledPage : internalPage;

  const isSortControlled = controlledSortState !== undefined;
  const currentSort = isSortControlled ? controlledSortState : internalSort;

  // ─── 2. URL Sync Effect ──────────────────────────────────────────
  useEffect(() => {
    if (!urlSync || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const searchParamKey = `${urlPrefix}search`;
    const pageParamKey = `${urlPrefix}page`;
    const sortParamKey = `${urlPrefix}sort`;
    const dirParamKey = `${urlPrefix}dir`;

    if (searchTerm) params.set(searchParamKey, searchTerm);
    else params.delete(searchParamKey);

    if (currentPage > 1) params.set(pageParamKey, String(currentPage));
    else params.delete(pageParamKey);

    if (currentSort) {
      params.set(sortParamKey, currentSort.columnKey);
      params.set(dirParamKey, currentSort.direction);
    } else {
      params.delete(sortParamKey);
      params.delete(dirParamKey);
    }

    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);
  }, [urlSync, urlPrefix, searchTerm, currentPage, currentSort]);

  // ─── 3. State Change Handlers ────────────────────────────────────
  const handleSearchChange = useCallback(
    (term: string) => {
      if (controlledOnSearchChange) {
        controlledOnSearchChange(term);
      } else {
        setInternalSearch(term);
      }
      if (controlledOnPageChange) {
        controlledOnPageChange(1);
      } else {
        setInternalPage(1);
      }
    },
    [controlledOnSearchChange, controlledOnPageChange]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (controlledOnPageChange) {
        controlledOnPageChange(newPage);
      } else {
        setInternalPage(newPage);
      }
    },
    [controlledOnPageChange]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      if (controlledOnPageSizeChange) {
        controlledOnPageSizeChange(newSize);
      } else {
        setInternalPageSize(newSize);
        setInternalPage(1);
      }
    },
    [controlledOnPageSizeChange]
  );

  const handleSortToggle = useCallback(
    (columnKey: string) => {
      let nextSort: SortState | null = null;
      if (!currentSort || currentSort.columnKey !== columnKey) {
        nextSort = { columnKey, direction: "asc" };
      } else if (currentSort.direction === "asc") {
        nextSort = { columnKey, direction: "desc" };
      } else {
        nextSort = null;
      }

      if (controlledOnSortChange) {
        controlledOnSortChange(nextSort as SortState);
      } else {
        setInternalSort(nextSort);
      }
    },
    [currentSort, controlledOnSortChange]
  );

  // ─── 4. Client-side In-memory Filtering, Sorting & Slicing ────────
  const filteredData = useMemo(() => {
    if (!searchable || !searchTerm.trim() || isSearchControlled) {
      return data;
    }

    const term = searchTerm.toLowerCase();
    return data.filter((row) => {
      if (searchKeys.length > 0) {
        return searchKeys.some((key) => {
          const val = row[key as string];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
        });
      }

      // Default: match all column accessors or keys
      return columns.some((col) => {
        const val = col.accessor ? col.accessor(row) : row[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, searchable, isSearchControlled, searchKeys, columns]);

  const sortedData = useMemo(() => {
    if (!currentSort || isSortControlled) {
      return filteredData;
    }

    const col = columns.find((c) => c.key === currentSort.columnKey);
    const getVal = (row: T) => (col?.accessor ? col.accessor(row) : row[currentSort.columnKey]);

    return [...filteredData].sort((a, b) => {
      const aVal = getVal(a);
      const bVal = getVal(b);

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return currentSort.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (currentSort.direction === "asc") {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [filteredData, currentSort, isSortControlled, columns]);

  // Total count resolution
  const effectiveTotalItems = totalCount !== undefined ? totalCount : sortedData.length;
  const effectivePageSize = isPageControlled ? initialPageSize : internalPageSize;
  const totalPages = Math.max(1, Math.ceil(effectiveTotalItems / effectivePageSize));

  const paginatedData = useMemo(() => {
    if (!paginated || isPageControlled) {
      return sortedData;
    }
    const start = (currentPage - 1) * effectivePageSize;
    return sortedData.slice(start, start + effectivePageSize);
  }, [sortedData, paginated, isPageControlled, currentPage, effectivePageSize]);

  // ─── 5. CSV Export Handler ───────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (!data.length) return;

    const visibleCols = columns.filter((col) => typeof col.header === "string");
    const headers = visibleCols.map((col) => `"${String(col.header).replace(/"/g, '""')}"`);

    const rows = sortedData.map((row) =>
      visibleCols
        .map((col) => {
          const val = col.accessor ? col.accessor(row) : row[col.key];
          const str = val === null || val === undefined ? "" : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data, columns, sortedData, exportFilename]);

  // Helper to render cell value
  const renderCell = (col: FacetColumn<T>, row: T, index: number) => {
    const val = col.accessor ? col.accessor(row) : row[col.key];
    if (col.render) return col.render(val, row, index);
    if (val === null || val === undefined || val === "")
      return <span className="text-label-tertiary">—</span>;
    return val;
  };

  const renderSortIcon = (colKey: string) => {
    if (!currentSort || currentSort.columnKey !== colKey) {
      return <ArrowUpDown aria-hidden="true" className="text-label-tertiary size-3 shrink-0" />;
    }
    return currentSort.direction === "asc" ? (
      <ArrowUp aria-hidden="true" className="text-tint size-3 shrink-0" />
    ) : (
      <ArrowDown aria-hidden="true" className="text-tint size-3 shrink-0" />
    );
  };

  // ─── 6. View Rendering ───────────────────────────────────────────
  const isEmpty = !loading && paginatedData.length === 0;

  return (
    <div data-slot="facet-data-table" className={cn("flex flex-col gap-4", className)}>
      {/* ─── Toolbar ──────────────────────────────────────────────── */}
      <FacetTableToolbar
        title={title}
        description={description}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        exportable={exportable}
        onExport={handleExportCSV}
        toolbarActions={toolbarActions}
      />

      {/* ─── Loading Skeleton View ────────────────────────────────── */}
      {loading ? (
        <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
          {/* Desktop Table Skeleton: shaped like the Table (header row + body rows) */}
          <FacetCard
            className={cn(
              layoutMode === "auto" ? "hidden sm:flex" : layoutMode === "table" ? "flex" : "hidden",
              "flex-col gap-3 overflow-hidden p-4"
            )}
          >
            <div className="border-separator flex gap-4 border-b pb-3">
              {columns.slice(0, 5).map((_, i) => (
                <Skeleton key={i} className="rounded-control-sm h-4 flex-1" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                {columns.slice(0, 5).map((_, j) => (
                  <Skeleton key={j} className="rounded-control-sm h-8 flex-1" />
                ))}
              </div>
            ))}
          </FacetCard>

          {/* Mobile Card Skeleton */}
          <div
            className={cn(
              layoutMode === "auto"
                ? "flex flex-col gap-3 sm:hidden"
                : layoutMode === "cards"
                  ? "flex flex-col gap-3"
                  : "hidden"
            )}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="rounded-card h-28 w-full" />
            ))}
          </div>
        </div>
      ) : isEmpty ? (
        /* ─── Empty State View ──────────────────────────────────────── */
        <FacetCard>
          <EmptyState
            icon={emptyIcon || <Database />}
            title={emptyMessage}
            message={
              searchTerm ? "Try adjusting your search terms or clearing active filters." : undefined
            }
          />
        </FacetCard>
      ) : (
        <>
          {/* ─── Desktop Table Mode (sm: and up) ────────────────────── */}
          {layoutMode !== "cards" && (
            <div className={cn(layoutMode === "auto" ? "hidden sm:block" : "block")}>
              <Table containerClassName={tableContainerClassName}>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => {
                      const sorted = currentSort?.columnKey === col.key ? currentSort : null;
                      const content = (
                        <>
                          <span>{col.header}</span>
                          {col.sortable && renderSortIcon(col.key)}
                        </>
                      );
                      const justify = cn(
                        col.align === "center" && "justify-center",
                        col.align === "right" && "justify-end"
                      );
                      return (
                        <TableHead
                          key={col.key}
                          aria-sort={
                            col.sortable
                              ? sorted
                                ? sorted.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                              : undefined
                          }
                          className={cn(
                            "px-4 py-3 select-none",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right",
                            col.sortable && "hover:text-label hover:bg-fill-4 transition-colors",
                            col.className,
                            col.headerClassName
                          )}
                        >
                          {col.sortable ? (
                            // A real button: sortable headers are reachable and operable by keyboard.
                            <button
                              type="button"
                              onClick={() => handleSortToggle(col.key)}
                              className={cn(
                                "rounded-control-sm focus-visible:outline-tint inline-flex w-full cursor-pointer items-center gap-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
                                justify
                              )}
                            >
                              {content}
                            </button>
                          ) : (
                            <div className={cn("flex items-center gap-1", justify)}>{content}</div>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedData.map((row, index) => (
                    <TableRow
                      key={row.id || index}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        onRowClick && "active:bg-fill-3 cursor-pointer",
                        rowClassName?.(row, index)
                      )}
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "px-4 py-3",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right",
                            col.className,
                            col.cellClassName
                          )}
                        >
                          {renderCell(col, row, index)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ─── Mobile Card Mode (< sm) ────────────────────────────── */}
          {layoutMode !== "table" && (
            <div
              className={cn(
                layoutMode === "auto" ? "flex flex-col gap-3 sm:hidden" : "flex flex-col gap-3",
                cardContainerClassName
              )}
            >
              {paginatedData.map((row, index) => (
                <FacetMobileCard
                  key={row.id || index}
                  row={row}
                  index={index}
                  columns={columns}
                  onClick={onRowClick}
                  className={cardClassName?.(row, index)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Pagination Controls ──────────────────────────────────── */}
      {paginated && !loading && !isEmpty && (
        <FacetTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={effectiveTotalItems}
          pageSize={effectivePageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
