"use client";

import { useState } from "react";
import { NavArrowDown as ChevronDown } from "iconoir-react";
import { formatTimeAgo } from "~/lib/utils";
import { cn } from "~/lib/utils";

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
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/50 bg-accent/10 px-2.5 py-1 text-[10px] font-medium tracking-tight transition-all duration-150 hover:bg-accent/20 active:scale-[0.96]"
      >
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-180")}
        />
        <span>
          {expanded ? "Hide" : "Show"} {subEdits.length} {isWiki ? "edits" : "items"}
        </span>
      </button>

      {expanded && (
        <div className="animate-in fade-in mt-2 space-y-1.5 rounded-xl border border-border/50 bg-muted/40 p-2.5 shadow-2xs backdrop-blur-md duration-150 dark:bg-black/30">
          {subEdits.map((sub: any, i: number) => {
            const subTitle = sub.content?.title ?? "";
            const subDesc = sub.content?.description ?? "";
            const display = isWiki ? subDesc.slice(0, 80) : subTitle.slice(0, 80);
            return (
              <div
                key={i}
                className="text-muted-foreground flex items-center justify-between py-0.5 text-[10px] tracking-tight"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="text-foreground shrink-0 font-semibold">
                    {sub.user?.name ?? "?"}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="truncate text-foreground/80">{display}</span>
                </div>
                <span className="text-muted-foreground/70 ml-2 shrink-0 font-medium tabular-nums">
                  {formatTimeAgo(new Date(sub.timestamp))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
