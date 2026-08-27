"use client";

import React from "react";
import Link from "next/link";
import { Folder } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { ALPHABET } from "./constants";

interface AlphabetIndexBarProps {
  activeLetter: string;
  onSelectLetter: (letter: string) => void;
  searchQuery: string;
  cleanedLiveCategories: any[];
  isLoading: boolean;
  effectiveQuery: string;
}

export function AlphabetIndexBar({
  activeLetter,
  onSelectLetter,
  searchQuery,
  cleanedLiveCategories,
  isLoading,
  effectiveQuery,
}: AlphabetIndexBarProps) {
  return (
    <div className="space-y-6">
      {/* A–Z Letter Selector */}
      <div className="border-border/60 no-scrollbar flex items-center gap-1 overflow-x-auto rounded-2xl border bg-white/50 p-1.5 backdrop-blur-md dark:bg-zinc-900/50">
        {ALPHABET.map((char) => {
          const isActive = activeLetter === char && !searchQuery.trim();
          return (
            <button
              key={char}
              onClick={() => onSelectLetter(char)}
              className={cn(
                "flex h-8 min-w-[32px] cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-bold transition-all",
                isActive
                  ? "scale-105 bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
            >
              {char}
            </button>
          );
        })}
      </div>

      {/* Category Results Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="wikios-loading-spinner" />
        </div>
      ) : cleanedLiveCategories.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {cleanedLiveCategories.map((cat) => (
            <Link
              key={cat.name}
              href={withBasePath(
                `/wiki/categories/${encodeURIComponent(cat.name.replace(/ /g, "_"))}`
              )}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-xl p-3.5",
                "border border-white/20 dark:border-white/10",
                "bg-white/60 backdrop-blur-md dark:bg-zinc-900/60",
                "shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)]",
                "hover:border-blue-500/40 hover:bg-white/90 hover:shadow-md dark:hover:bg-zinc-900/90",
                "transition-all duration-200 active:scale-[0.98]"
              )}
            >
              <div className="flex items-start gap-2.5">
                <Folder className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-xs font-semibold transition-colors group-hover:text-blue-500">
                    {cat.name}
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                    {cat.pages > 0 && <span>{cat.pages} pages</span>}
                    {cat.subcats > 0 && <span>· {cat.subcats} subcats</span>}
                    {cat.files > 0 && <span>· {cat.files} files</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No categories found starting with &quot;{effectiveQuery}&quot;.
        </div>
      )}
    </div>
  );
}
