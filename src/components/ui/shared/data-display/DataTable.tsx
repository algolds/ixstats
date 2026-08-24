"use client";

import React, { useMemo } from "react";
import { FacetDataTable, type FacetColumn, type MobileRole } from "~/components/ui/data-table";

export interface Column<T> {
  key: string;
  label: string;
  header?: string | React.ReactNode;
  sortable?: boolean;
  render?: (value: any, row: T, index?: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  mobileRole?: MobileRole;
  mobileLabel?: string;
  hideOnMobile?: boolean;
  mobileRender?: (value: any, row: T, index?: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  paginated?: boolean;
  pageSize?: number;
  className?: string;
  loading?: boolean;
  emptyMessage?: string | React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index?: number) => string;
  layoutMode?: "auto" | "table" | "cards";
  exportable?: boolean;
  exportFilename?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  description,
  searchable = false,
  searchPlaceholder = "Search...",
  searchKeys = [],
  paginated = false,
  pageSize = 10,
  className,
  loading = false,
  emptyMessage = "No data available",
  onRowClick,
  rowClassName,
  layoutMode = "auto",
  exportable = false,
  exportFilename,
}: DataTableProps<T>) {
  // Map Column<T> to FacetColumn<T>
  const facetColumns = useMemo<FacetColumn<T>[]>(() => {
    return columns.map((col) => ({
      key: col.key,
      header: col.header || col.label,
      sortable: col.sortable,
      align: col.align,
      className: col.className,
      render: col.render,
      mobileRole: col.mobileRole,
      mobileLabel: col.mobileLabel || col.label,
      hideOnMobile: col.hideOnMobile,
      mobileRender: col.mobileRender,
    }));
  }, [columns]);

  return (
    <FacetDataTable
      data={data}
      columns={facetColumns}
      title={title}
      description={description}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      searchKeys={searchKeys}
      paginated={paginated}
      pageSize={pageSize}
      loading={loading}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      rowClassName={rowClassName ? (r, i) => rowClassName(r, i) : undefined}
      layoutMode={layoutMode}
      exportable={exportable}
      exportFilename={exportFilename}
      className={className}
    />
  );
}

export default DataTable;
