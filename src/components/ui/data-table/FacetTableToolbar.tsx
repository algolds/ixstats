"use client";

import React from "react";
import { Search, Xmark as X, Download } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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
          {title && (
            <h3 className="text-foreground text-base sm:text-lg font-bold tracking-tight truncate">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs font-normal">
              {description}
            </p>
          )}
        </div>
      )}

      {/* ─── Actions, Search & Export Controls ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
        {searchable && (
          <div className="relative w-full max-w-xs min-w-[200px] flex-1 sm:w-64 sm:flex-none">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="border-border/50 bg-background/50 focus:border-primary/50 focus-visible:ring-primary/20 text-foreground h-9 rounded-xl pl-9 pr-8 text-xs backdrop-blur-md transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {toolbarActions}

        {exportable && onExport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            className="border-border/50 bg-card/60 hover:bg-muted text-foreground h-9 rounded-xl px-3 text-xs font-semibold backdrop-blur-md active:scale-95"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>
    </div>
  );
}
