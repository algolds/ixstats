"use client";

import React from "react";
import Link from "next/link";
import { Folder } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { ALPHABET } from "./constants";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

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
      <div className="border-separator no-scrollbar rounded-card bg-surface flex items-center gap-1 overflow-x-auto border p-2">
        <ToggleGroup
          type="single"
          size="sm"
          aria-label="Category index"
          value={searchQuery.trim() ? "" : activeLetter}
          onValueChange={(char) => onSelectLetter(char || activeLetter)}
          className="flex items-center gap-1"
        >
          {ALPHABET.map((char) => (
            <ToggleGroupItem key={char} value={char} className="text-caption min-w-8 font-semibold">
              {char}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
                `/util/categories/${encodeURIComponent(cat.name.replace(/ /g, "_"))}`
              )}
              className={cn(
                "group rounded-row relative flex flex-col justify-between overflow-hidden p-4",
                "border-separator border",
                "bg-surface",
                "",
                "hover:border-tint/40 hover:bg-surface hover:shadow-card",
                "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 active:scale-[0.98]"
              )}
            >
              <div className="flex items-start gap-2">
                <Folder className="text-tint mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-label text-caption group-hover:text-tint truncate font-semibold transition-colors">
                    {cat.name}
                  </div>
                  <div className="text-label-secondary text-footnote mt-1 flex items-center gap-2">
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
        <div className="text-label-secondary text-body py-12 text-center">
          No categories found starting with &quot;{effectiveQuery}&quot;.
        </div>
      )}
    </div>
  );
}
