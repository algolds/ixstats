"use client";

import React from "react";
import { Download } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import { cn } from "~/lib/utils/cn";

interface FacetTableToolbarProps {
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  exportable?: boolean;
  onExport?: () => void;
  toolbarActions?: React.ReactNode;
  className?: string;
}

export function FacetTableToolbar({
  title,
  description,
  searchable = false,
  searchPlaceholder = "Search records...",
  searchTerm,
  onSearchChange,
  exportable = false,
  onExport,
  toolbarActions,
  className,
}: FacetTableToolbarProps) {
  if (!title && !description && !searchable && !exportable && !toolbarActions) {
    return null;
  }

  return (
    <div
      data-slot="facet-table-toolbar"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {/* ─── Title & Description ──────────────────────────────────── */}
      {(title || description) && (
        <div className="min-w-0 flex-1">
          {title && <h3 className="text-title-3 text-label truncate">{title}</h3>}
          {description && (
            <p className="text-footnote text-label-secondary mt-0.5">{description}</p>
          )}
        </div>
      )}

      {/* ─── Actions, Search & Export Controls ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {searchable && (
          <SearchField
            value={searchTerm}
            onValueChange={onSearchChange}
            placeholder={searchPlaceholder}
            aria-label={typeof title === "string" ? `Search ${title}` : "Search records"}
            containerClassName="w-full max-w-xs min-w-[200px] flex-1 sm:w-64 sm:flex-none"
          />
        )}

        {toolbarActions}

        {exportable && onExport && (
          <Button type="button" variant="bordered" size="md" onClick={onExport}>
            <Download aria-hidden="true" />
            Export CSV
          </Button>
        )}
      </div>
    </div>
  );
}
