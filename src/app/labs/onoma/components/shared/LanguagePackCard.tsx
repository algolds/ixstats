"use client";

import { BookmarkBook, GitFork, Star, Translate } from "iconoir-react";

// src/app/labs/onoma/components/shared/LanguagePackCard.tsx
// Onoma Lab — Language pack card: an inset panel inside the workspace card.

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

export interface LanguagePack {
  id: string;
  name: string;
  description: string | null;
  authorId?: string | null;
  authorName?: string | null;
  culturalFamily: string;
  ratingAvg: number;
  ratingCount: number;
  forkCount?: number;
  isOfficial?: boolean;
  tags: string[];
  phonologyRules?: any;
  morphologyRules?: any;
  createdAt?: string | Date;
}

interface LanguagePackCardProps {
  pack: LanguagePack;
  isSelected?: boolean;
  onSelect?: (pack: LanguagePack) => void;
  onFork?: (pack: LanguagePack) => void;
  isForking?: boolean;
}

const FAMILY_THEMES: Record<string, { text: string }> = {
  latin: { text: "text-yellow" },
  germanic: { text: "text-blue" },
  celtic: { text: "text-green" },
  slavic: { text: "text-indigo" },
  "east-asian": { text: "text-red" },
  persian: { text: "text-teal" },
  constructed: { text: "text-indigo" },
  default: { text: "text-tint" },
};

export function LanguagePackCard({
  pack,
  isSelected = false,
  onSelect,
  onFork,
  isForking = false,
}: LanguagePackCardProps) {
  const familyKey = (pack.culturalFamily || "").toLowerCase();
  const theme = FAMILY_THEMES[familyKey] || FAMILY_THEMES.default;

  return (
    <div className="flex w-full flex-col">
      <Card
        variant="well"
        padding="lg"
        onClick={() => onSelect?.(pack)}
        aria-pressed={isSelected}
        className={cn(
          "flex h-full min-h-[300px] w-full flex-col justify-between",
          isSelected && "ring-tint ring-2"
        )}
        interactive
      >
        {/* Card Header: Category Badge + Rating */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="default" className={cn("font-mono", theme.text)}>
            {pack.culturalFamily}
          </Badge>

          <Badge variant="warning" className="tabular-nums">
            <Star className="fill-yellow" />
            <span>{pack.ratingAvg > 0 ? pack.ratingAvg.toFixed(1) : "New"}</span>
            {pack.ratingCount > 0 && (
              <span className="text-label-secondary text-caption font-normal">
                ({pack.ratingCount})
              </span>
            )}
          </Badge>
        </div>

        {/* Card Body / Emblem & Typography */}
        <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
          <div className="bg-surface rounded-row mb-3 p-3">
            <BookmarkBook className={cn("h-7 w-7", theme.text)} />
          </div>

          <h3 className="text-label text-body line-clamp-1 font-semibold">{pack.name}</h3>

          {pack.authorName && (
            <span className="text-label-secondary text-caption mt-0.5 font-mono">
              by @{pack.authorName}
            </span>
          )}

          <p className="text-label-secondary text-footnote mt-2 line-clamp-2 max-w-[260px] leading-relaxed">
            {pack.description || "Phonological rules, syllabic weights and lexicon seeds."}
          </p>

          {pack.tags && pack.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
              {pack.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="bg-fill-3 text-label-secondary rounded-control-sm text-caption px-2 font-mono"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer: Action Buttons */}
        <div className="border-separator mt-1 flex w-full items-center gap-2 border-t pt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(pack);
            }}
            className="flex-1"
          >
            <Translate />
            <span>Inspect</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isForking}
            onClick={(e) => {
              e.stopPropagation();
              onFork?.(pack);
            }}
            className="flex-1"
          >
            <GitFork />
            <span>Fork pack</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
