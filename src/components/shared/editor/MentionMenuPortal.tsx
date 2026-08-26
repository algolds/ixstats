// src/components/shared/editor/MentionMenuPortal.tsx
// Floating portal menu for account and entity @mentions in PlateJS editors.

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SystemRestart as Loader2 } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface MentionMenuPortalProps {
  coords: { top: number; left: number };
  results: any[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  query: string;
  isLoading: boolean;
}

export function MentionMenuPortal({
  coords,
  results,
  selectedIndex,
  onSelect,
  query,
  isLoading,
}: MentionMenuPortalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        top: coords.top + 4,
        left: coords.left,
        zIndex: 200000,
      }}
      className="animate-in fade-in-50 slide-in-from-top-1 dark:border-border dark:bg-popover/98 dark:text-foreground w-64 rounded-xl border border-neutral-200/80 bg-white/95 p-1.5 text-neutral-800 shadow-2xl backdrop-blur-xl duration-150 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
    >
      <div className="thin-scrollbar max-h-56 overflow-y-auto">
        {isLoading && results.length === 0 ? (
          <div className="dark:text-muted-foreground flex items-center justify-center py-4 text-xs text-neutral-400">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-blue-500" />
            <span>Searching...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-0.5">
            {results.map((item, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => onSelect(idx)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 select-none",
                    active
                      ? "border-l-[3px] border-blue-500 bg-blue-500/10 font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                      : "text-neutral-700 hover:bg-neutral-500/5 dark:text-slate-300 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-neutral-200/50 bg-neutral-100/50 text-[11px] leading-none dark:border-white/5 dark:bg-white/5">
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs leading-tight font-bold">{item.name}</div>
                    <div className="mt-0.5 truncate text-[9px] font-semibold tracking-wider text-neutral-400 uppercase dark:text-slate-500">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-neutral-400 dark:text-slate-500">
            {query.trim().length > 0 ? (
              <span>No matches found</span>
            ) : (
              <span>Type to search citizens, leagues, teams, or countries...</span>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
