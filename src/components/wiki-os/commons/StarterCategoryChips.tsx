"use client";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/** Commons categories to start from when nothing has been searched or browsed yet. */
export const STARTER_CATEGORIES = [
  { label: "Historical maps", category: "Historical maps" },
  { label: "Coats of arms", category: "Coats of arms by country" },
  { label: "Royal residences", category: "Royal residences by country" },
  { label: "Castles", category: "Castles by country" },
  { label: "Military flags", category: "Military flags" },
  { label: "Portrait paintings", category: "Portrait paintings" },
] as const;

/** "Try:" chips that open a starter category; the repository page and the image picker share them. */
export function StarterCategoryChips({
  onBrowseCategory,
  className,
}: {
  onBrowseCategory: (category: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-footnote text-label-secondary mr-1">Try:</span>
      {STARTER_CATEGORIES.map((cat) => (
        <Button
          variant="outline"
          size="sm"
          key={cat.category}
          onClick={() => onBrowseCategory(cat.category)}
          className="text-label-secondary hover:text-tint rounded-full"
        >
          {cat.label}
        </Button>
      ))}
    </div>
  );
}
