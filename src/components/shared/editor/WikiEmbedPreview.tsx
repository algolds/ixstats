"use client";
// src/components/shared/editor/WikiEmbedPreview.tsx
// The composer wiki dialog's live preview of an embed card: the article's intro and its images to pick from.

import { Eye } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";
import { WIKI_SOURCES, type WikiSource } from "~/lib/wiki-os/config";
import { pickableEmbedImages } from "~/lib/wiki-os/embed-image";
import { isWikiOutage, unreachableText } from "~/lib/wiki-os/wiki-outage";

/** A query's state as the preview reads it (a tRPC query result fits). */
interface QueryState<T> {
  isLoading: boolean;
  data?: T;
  error?: { data?: { code?: string } | null } | null;
}

export interface WikiEmbedPreviewProps {
  source: WikiSource;
  introQuery: QueryState<RouterOutputs["wikios"]["getIntro"]>;
  imagesQuery: QueryState<RouterOutputs["wikios"]["getPageImages"]>;
  /** The image the embed will carry, as stored (the page image's thumbnail URL, else its URL). */
  selectedImageUrl: string;
  onSelectImage: (url: string) => void;
}

const NOTE_CLASS = "text-muted-foreground text-xs";

/** What the preview says about the article: its intro, that it is missing or loading, or that its wiki is down. */
function introLine(source: WikiSource, introQuery: WikiEmbedPreviewProps["introQuery"]): string {
  if (introQuery.isLoading) return "Loading article preview...";
  if (isWikiOutage(introQuery.error)) return unreachableText(source);
  const intro = introQuery.data;
  if (!intro) return "Type an exact title to preview.";
  if (intro.missing) return `${WIKI_SOURCES[source].name} has no page with this title.`;
  return intro.text || "No intro text available.";
}

/**
 * The live embed preview: the intro line, then (for a page that exists) up to four of its images a card can show,
 * each loaded as a card would, each a toggle button to put it on the card.
 */
export function WikiEmbedPreview({
  source,
  introQuery,
  imagesQuery,
  selectedImageUrl,
  onSelectImage,
}: WikiEmbedPreviewProps) {
  const exists = introQuery.data !== undefined && !introQuery.data.missing;
  const images = exists ? pickableEmbedImages(imagesQuery.data, source).slice(0, 4) : [];

  return (
    <div className="border-border/60 bg-muted/30 space-y-2 rounded-lg border p-2">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Eye className="h-3 w-3" /> Live embed preview
      </div>
      <p className={cn(NOTE_CLASS, exists && "text-foreground line-clamp-2")}>
        {introLine(source, introQuery)}
      </p>
      {images.length > 0 && (
        <div className="flex gap-1 overflow-x-auto py-1">
          {images.map(({ name, stored, src }) => (
            <button
              key={stored}
              type="button"
              aria-pressed={selectedImageUrl === stored}
              aria-label={`Use ${name} on the card`}
              onClick={() => onSelectImage(stored === selectedImageUrl ? "" : stored)}
              className={cn(
                "focus-visible:ring-wiki shrink-0 rounded border transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] focus-visible:ring-2 focus-visible:outline-none",
                selectedImageUrl === stored
                  ? "border-wiki ring-wiki/50 ring-2"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img src={src} alt="" className="h-10 w-10 rounded object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
