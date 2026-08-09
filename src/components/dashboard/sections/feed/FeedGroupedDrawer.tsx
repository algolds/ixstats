"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatTimeAgo } from "~/lib/time-utils";
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
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-tight text-muted-foreground transition-all duration-150 hover:bg-white/[0.08] hover:text-foreground active:scale-[0.96]"
      >
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-180")}
        />
        <span>
          {expanded ? "Hide" : "Show"} {subEdits.length} {isWiki ? "edits" : "items"}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-2.5 shadow-inner animate-in fade-in duration-150">
          {subEdits.map((sub: any, i: number) => {
            const subTitle = sub.content?.title ?? "";
            const subDesc = sub.content?.description ?? "";
            const display = isWiki ? subDesc.slice(0, 80) : subTitle.slice(0, 80);
            return (
              <div
                key={i}
                className="flex items-center justify-between text-[10px] tracking-tight text-muted-foreground py-0.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="font-semibold text-foreground/80 shrink-0">
                    {sub.user?.name ?? "?"}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="truncate">{display}</span>
                </div>
                <span className="ml-2 shrink-0 font-medium tabular-nums text-muted-foreground/60">
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
