"use client";

import { useState } from "react";
import { NavArrowDown as ChevronDown } from "iconoir-react";
import { timeAgo } from "~/lib/format/compact";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export interface FeedGroupedDrawerProps {
  subEdits: any[];
  isWiki: boolean;
  className?: string;
}

export function FeedGroupedDrawer({ subEdits, isWiki, className }: FeedGroupedDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!subEdits || subEdits.length <= 1) return null;

  return (
    <div className={cn("pt-1", className)}>
      <Button
        type="button"
        variant="gray"
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
          {expanded ? "Hide" : "Show"} {subEdits.length} {isWiki ? "edits" : "items"}
        </span>
      </Button>

      {expanded && (
        <div className="bg-surface-secondary rounded-row mt-2 space-y-1 p-3">
          {subEdits.map((sub: any, i: number) => {
            const subTitle = sub.content?.title ?? "";
            const subDesc = sub.content?.description ?? "";
            const display = isWiki ? subDesc.slice(0, 80) : subTitle.slice(0, 80);
            return (
              <div
                key={i}
                className="text-label-secondary text-footnote flex items-center justify-between py-0.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="text-label shrink-0 font-medium">{sub.user?.name ?? "?"}</span>
                  <span aria-hidden className="text-label-tertiary">
                    ·
                  </span>
                  <span className="truncate">{display}</span>
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
