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
      <div className="flex items-center gap-1 overflow-x-auto p-1.5 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border border-border/60 backdrop-blur-md no-scrollbar">
        {ALPHABET.map((char) => {
          const isActive = activeLetter === char && !searchQuery.trim();
          return (
            <button
              key={char}
              onClick={() => onSelectLetter(char)}
              className={cn(
                "flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                isActive
                  ? "bg-blue-600 text-white shadow-sm scale-105"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {cleanedLiveCategories.map((cat) => (
            <Link
              key={cat.name}
              href={withBasePath(
                `/wiki/categories/${encodeURIComponent(cat.name.replace(/ /g, "_"))}`
              )}
              className={cn(
                "group relative overflow-hidden flex flex-col justify-between p-3.5 rounded-xl",
                "border border-white/20 dark:border-white/10",
                "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md",
                "shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)]",
                "hover:border-blue-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-md",
                "transition-all duration-200 active:scale-[0.98]"
              )}
            >
              <div className="flex items-start gap-2.5">
                <Folder className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground truncate group-hover:text-blue-500 transition-colors">
                    {cat.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
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
        <div className="text-center py-12 text-sm text-muted-foreground">
          No categories found starting with &quot;{effectiveQuery}&quot;.
        </div>
      )}
    </div>
  );
}
