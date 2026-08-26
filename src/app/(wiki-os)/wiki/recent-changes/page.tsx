// src/app/(wiki-os)/wiki/recent-changes/page.tsx
// WikiOS Recent Changes — grouped by page, with byte diffs, filters, and collapsible edits.
"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { formatMWTimeAgo, parseMWDateObject } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import {
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Page as FileText,
  PagePlus as FilePlus,
  Filter,
} from "iconoir-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawChange {
  title: string;
  user: string;
  timestamp: string;
  comment: string;
  type: "edit" | "new" | "log";
  oldLen: number;
  newLen: number;
}

interface GroupedPage {
  title: string;
  edits: RawChange[];
  totalDelta: number;
  latestTimestamp: string;
  latestUser: string;
  isNew: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function byteDelta(change: RawChange): number {
  if (change.oldLen === 0 && change.newLen > 0) {
    return change.newLen;
  }
  return change.newLen - change.oldLen;
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toLocaleString()}`;
  return delta.toLocaleString();
}

function deltaClass(delta: number): string {
  if (delta > 0) return "wikios-rc-delta--pos";
  if (delta < 0) return "wikios-rc-delta--neg";
  return "";
}

function getSemanticAction(change: RawChange): { label: string; isPill: boolean; pillClass?: string } {
  const comment = change.comment?.trim() || "";
  const isSyncPlaceholder = /live sync/i.test(comment) || /mediawiki/i.test(comment);

  if (comment && !isSyncPlaceholder) {
    return { label: `“${comment}”`, isPill: false };
  }

  const delta = byteDelta(change);

  if (change.type === "new" || change.oldLen === 0) {
    return {
      label: "Created page",
      isPill: true,
      pillClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
    };
  }

  if (delta > 1000) {
    return {
      label: `Expanded article (+${delta.toLocaleString()} B)`,
      isPill: true,
      pillClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25",
    };
  }

  if (delta < -500) {
    return {
      label: `Trimmed content (${delta.toLocaleString()} B)`,
      isPill: true,
      pillClass: "bg-amber-500/10 text-amber-400 border border-amber-500/25",
    };
  }

  return {
    label: "Updated content",
    isPill: true,
    pillClass: "bg-white/5 text-muted-foreground border border-white/10",
  };
}

// ---------------------------------------------------------------------------
// Date range options
// ---------------------------------------------------------------------------

const DATE_RANGES = [
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
  { label: "All", hours: 0 },
] as const;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function RecentChangesPage() {
  const [dateRange, setDateRange] = useState(168); // 7 days default
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  const { data: changes, isLoading } = api.wikios.getRecentChanges.useQuery(
    { limit: 100 },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );

  // Filter by date range
  const filtered = useMemo(() => {
    if (!changes || changes.length === 0) return [];
    if (dateRange === 0) return changes;
    const cutoff = Date.now() - dateRange * 60 * 60 * 1000;
    return changes.filter((c) => {
      const d = parseMWDateObject(c.timestamp);
      return d ? d.getTime() > cutoff : true;
    });
  }, [changes, dateRange]);

  // Group by page title
  const grouped: GroupedPage[] = useMemo(() => {
    const map = new Map<string, RawChange[]>();
    for (const c of filtered) {
      const existing = map.get(c.title);
      if (existing) existing.push(c);
      else map.set(c.title, [c]);
    }

    return Array.from(map.entries()).map(([title, edits]) => ({
      title,
      edits,
      totalDelta: edits.reduce((sum, e) => sum + byteDelta(e), 0),
      latestTimestamp: edits[0]!.timestamp,
      latestUser: edits[0]!.user,
      isNew: edits.some((e) => e.type === "new" || e.oldLen === 0),
    }));
  }, [filtered]);

  const toggleExpand = (title: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <WikiOSLayout title="Recent changes">
      <div className="wikios-special-page">
        {/* Toolbar */}
        <div className="wikios-rc-toolbar">
          <div className="wikios-rc-toolbar-left">
            <Filter className="h-3.5 w-3.5 text-[var(--wikios-text-dim)]" />
            <span className="text-xs text-[var(--wikios-text-dim)]">Range:</span>
            {DATE_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setDateRange(r.hours)}
                className={`wikios-rc-range-btn ${
                  dateRange === r.hours ? "wikios-rc-range-btn--active" : ""
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-[var(--wikios-text-dim)]">
            {grouped.length} {grouped.length === 1 ? "page" : "pages"} updated
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="wikios-rc-skeleton h-12" />
            ))}
          </div>
        )}

        {/* Change groups */}
        {!isLoading && grouped.length > 0 && (
          <div className="wikios-rc-groups">
            {grouped.map((group) => {
              const isExpanded = expandedPages.has(group.title);
              const hasMultiple = group.edits.length > 1;

              return (
                <div key={group.title} className="wikios-rc-group">
                  {/* Group header row */}
                  <div
                    className={`wikios-rc-group-header ${
                      hasMultiple ? "cursor-pointer select-none" : ""
                    }`}
                    onClick={() => hasMultiple && toggleExpand(group.title)}
                  >
                    {hasMultiple ? (
                      <button
                        type="button"
                        className="wikios-rc-expand-btn"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="wikios-rc-expand-btn">
                        {group.isNew ? (
                          <FilePlus className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    )}

                    <Link
                      href={withBasePath(
                        `/wiki/${encodeURIComponent(group.title.replace(/ /g, "_"))}`
                      )}
                      className="wikios-rc-group-title"
                    >
                      {group.title}
                    </Link>

                    {hasMultiple && (
                      <span className="wikios-rc-edit-count">{group.edits.length} edits</span>
                    )}

                    <span className={`wikios-rc-delta ${deltaClass(group.totalDelta)}`}>
                      {formatDelta(group.totalDelta)}
                    </span>

                    <span className="wikios-rc-group-meta">
                      {group.latestUser} · {formatMWTimeAgo(group.latestTimestamp)}
                    </span>
                  </div>

                  {/* Expanded individual edits */}
                  {isExpanded && hasMultiple && (
                    <div className="wikios-rc-edits">
                      {group.edits.map((edit, idx) => {
                        const delta = byteDelta(edit);
                        const action = getSemanticAction(edit);
                        return (
                          <div key={idx} className="wikios-rc-edit">
                            <span
                              className={`wikios-rc-delta wikios-rc-delta--sm ${deltaClass(delta)}`}
                            >
                              {formatDelta(delta)}
                            </span>
                            <span className="wikios-rc-edit-user">{edit.user}</span>
                            <span className="wikios-rc-edit-time">
                              {formatMWTimeAgo(edit.timestamp)}
                            </span>
                            {action.isPill ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tight ${action.pillClass}`}
                              >
                                {action.label}
                              </span>
                            ) : (
                              <span className="wikios-rc-edit-comment">{action.label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Single edit comment or action tag */}
                  {!hasMultiple &&
                    group.edits[0] &&
                    (() => {
                      const action = getSemanticAction(group.edits[0]);
                      return action.isPill ? (
                        <div className="mt-1 flex items-center gap-1.5 pl-6 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tight ${action.pillClass}`}
                          >
                            {action.label}
                          </span>
                        </div>
                      ) : (
                        <div className="wikios-rc-single-comment">{action.label}</div>
                      );
                    })()}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--wikios-text-dim)]">
            No recent changes in this time range.
          </p>
        )}
      </div>
    </WikiOSLayout>
  );
}
