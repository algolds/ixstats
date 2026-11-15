"use client";

import { useState } from "react";
import Link from "next/link";
import { NavArrowDown as ChevronDown } from "iconoir-react";
import { timeAgo } from "~/lib/format/compact";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface GroupedSubItem {
  timestamp: string | Date;
  user?: {
    name?: string;
    countryName?: string | null;
  } | null;
  content?: {
    title?: string;
    metadata?: {
      achievementName?: string;
      achievementKey?: string;
    } | null;
  } | null;
}

interface FeedGroupedDrawerProps {
  subEdits: GroupedSubItem[];
  itemLabel?: string;
  className?: string;
}

function subItemText(sub: GroupedSubItem): string {
  const achievementName = sub.content?.metadata?.achievementName;
  if (achievementName) return achievementName;
  return (sub.content?.title ?? "").slice(0, 80);
}

export function FeedGroupedDrawer({
  subEdits,
  itemLabel = "items",
  className,
}: FeedGroupedDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!subEdits || subEdits.length <= 1) return null;

  return (
    <div className={cn("pt-1", className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "duration-fast ease-out-facet transition-transform",
            expanded && "rotate-180"
          )}
        />
        <span>
          {expanded ? "Hide" : "Show"} {subEdits.length} {itemLabel}
        </span>
      </Button>

      {expanded && (
        <div className="bg-surface-secondary rounded-row mt-2 space-y-1 p-3">
          {subEdits.map((sub, i) => {
            const actor = sub.user?.countryName || sub.user?.name || "?";
            const display = subItemText(sub);
            const achievementKey = sub.content?.metadata?.achievementKey;
            return (
              <div
                key={i}
                className="text-label-secondary text-footnote flex items-center justify-between py-0.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                  <span className="text-label shrink-0 font-medium">{actor}</span>
                  <span aria-hidden className="text-label-tertiary">
                    ·
                  </span>
                  {achievementKey ? (
                    <Link
                      href={`/vault/achievements?a=${encodeURIComponent(achievementKey)}`}
                      className="hover:text-label truncate underline-offset-2 hover:underline"
                    >
                      {display}
                    </Link>
                  ) : (
                    <span className="truncate">{display}</span>
                  )}
                </div>
                <span className="ml-2 shrink-0 tabular-nums">
                  {timeAgo(new Date(sub.timestamp))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
