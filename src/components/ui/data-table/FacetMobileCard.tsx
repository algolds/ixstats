"use client";

import React from "react";
import { cn } from "~/lib/utils";
import type { FacetColumn } from "./types";

interface FacetMobileCardProps<T> {
  row: T;
  index: number;
  columns: FacetColumn<T>[];
  onClick?: (row: T) => void;
  className?: string;
}

export function FacetMobileCard<T extends Record<string, any>>({
  row,
  index,
  columns,
  onClick,
  className,
}: FacetMobileCardProps<T>) {
  // Helper to extract value
  const getVal = (col: FacetColumn<T>) => {
    if (col.accessor) return col.accessor(row);
    return row[col.key];
  };

  // Helper to render value (preferring mobileRender, then render, then raw value)
  const renderCell = (col: FacetColumn<T>) => {
    const val = getVal(col);
    if (col.mobileRender) return col.mobileRender(val, row, index);
    if (col.render) return col.render(val, row, index);
    if (val === null || val === undefined || val === "")
      return <span className="text-muted-foreground/50">—</span>;
    return val;
  };

  // Group columns by mobile role (excluding hidden columns)
  const visibleCols = columns.filter((col) => !col.hideOnMobile);

  const heroCols = visibleCols.filter((col) => col.mobileRole === "hero");
  const badgeCols = visibleCols.filter((col) => col.mobileRole === "badge");
  const actionCols = visibleCols.filter((col) => col.mobileRole === "action");
  const subtitleCols = visibleCols.filter((col) => col.mobileRole === "subtitle");
  const footerCols = visibleCols.filter((col) => col.mobileRole === "footer");
  const fieldCols = visibleCols.filter((col) => !col.mobileRole || col.mobileRole === "field");

  // If no explicit hero column was specified, fallback to the first visible column as hero
  const effectiveHeroCols = heroCols.length > 0 ? heroCols : [visibleCols[0]].filter(Boolean);
  const effectiveFieldCols =
    heroCols.length > 0 ? fieldCols : fieldCols.filter((c) => c !== effectiveHeroCols[0]);

  return (
    <div
      data-slot="facet-mobile-card"
      data-cuelume-press
      onClick={() => onClick?.(row)}
      className={cn(
        "facet-surface border-border/50 bg-card/70 relative flex flex-col gap-3 rounded-2xl border p-4 shadow-sm backdrop-blur-xl transition-all duration-150",
        onClick && "hover:border-border/80 hover:bg-card/90 cursor-pointer active:scale-[0.98]",
        className
      )}
    >
      {/* ─── Header: Hero + Badges + Actions ─────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {effectiveHeroCols.map((col) => (
            <div key={col.key} className="text-foreground text-sm font-bold tracking-tight">
              {renderCell(col)}
            </div>
          ))}

          {subtitleCols.map((col) => (
            <div key={col.key} className="text-muted-foreground mt-0.5 text-xs font-normal">
              {renderCell(col)}
            </div>
          ))}
        </div>

        {/* Badges & Actions aligned right */}
        {(badgeCols.length > 0 || actionCols.length > 0) && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {badgeCols.map((col) => (
              <div key={col.key}>{renderCell(col)}</div>
            ))}
            {actionCols.map((col) => (
              <div key={col.key} onClick={(e) => e.stopPropagation()}>
                {renderCell(col)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Body: Key-Value Field Matrix ────────────────────────── */}
      {effectiveFieldCols.length > 0 && (
        <div className="border-border/30 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs">
          {effectiveFieldCols.map((col) => {
            const label =
              col.mobileLabel || (typeof col.header === "string" ? col.header : col.key);
            return (
              <div key={col.key} className="flex min-w-0 flex-col gap-0.5">
                <span className="text-muted-foreground/80 truncate text-[10px] font-semibold tracking-wider uppercase">
                  {label}
                </span>
                <div
                  className={cn(
                    "text-foreground truncate text-xs font-medium",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                >
                  {renderCell(col)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Footer: Full-width details / actions ────────────────── */}
      {footerCols.length > 0 && (
        <div className="border-border/30 flex items-center justify-between border-t pt-2.5 text-xs">
          {footerCols.map((col) => (
            <div key={col.key} className="w-full">
              {renderCell(col)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
