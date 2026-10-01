"use client";
// src/components/wiki-os/stashes/StashPagesList.tsx
// Saved wiki articles view with lead image thumbnail, WikiOS logomark, rich metadata, and quick actions.
// Full Apple Design & Facet compliance.

import { useMemo, useState } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import {
  Clock,
  DesignPencil as Highlighter,
  Page as StickyNote,
  ArrowRight,
  Xmark as X,
} from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { sanitizeUserContent } from "~/lib/utils";

import type { StashedPageItem } from "./types";
import { Button } from "~/components/ui/button";

interface StashPagesListProps {
  items: StashedPageItem[];
  onUnstash: (pageTitle: string, contentType?: string) => void;
  thumbnailsMap?: Record<string, string>;
}

/** A stashed page's own note, sanitized once: one `{ __html }` per note, or React 19 writes it again on every render. */
function StashNote({ note }: { note: string }) {
  const markup = useMemo(() => ({ __html: sanitizeUserContent(note) }), [note]);

  return (
    <div
      className="rounded-row border-separator bg-surface text-footnote text-label-secondary border p-3 leading-relaxed italic"
      dangerouslySetInnerHTML={markup}
    />
  );
}

function StashArticleThumbnail({ thumbUrl, title }: { thumbUrl?: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);

  if (!thumbUrl || hasError) {
    return (
      <div className="rounded-row border-separator bg-surface text-tint group-hover/title:border-tint relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border opacity-85 transition-[color,background-color,border-color,box-shadow,opacity,transform] group-hover/title:opacity-100 sm:h-14 sm:w-14">
        <WikiOSLogomark className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="rounded-row border-separator bg-surface group-hover/title:border-tint relative h-12 w-12 shrink-0 overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform] sm:h-14 sm:w-14">
      <img
        src={thumbUrl}
        alt={title}
        className="h-full w-full object-cover transition-transform duration-300 group-hover/title:scale-105"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function StashPagesList({ items, onUnstash, thumbnailsMap = {} }: StashPagesListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const annotations = item.annotations || [];
        const cleanTitle = item.pageTitle.replace(/_/g, " ");
        const thumbUrl =
          thumbnailsMap[item.pageTitle] ||
          thumbnailsMap[cleanTitle] ||
          thumbnailsMap[item.pageSlug];

        return (
          <div
            key={item.id}
            className="group rounded-card border-separator bg-surface hover:border-separator hover:bg-surface hover:shadow-card relative flex flex-col gap-3 overflow-hidden border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
          >
            {/* Header Lockup & Title Link */}
            <div className="flex items-start justify-between gap-3">
              <Link
                href={withBasePath(`/wiki/${item.pageSlug}`)}
                className="group/title flex min-w-0 flex-1 items-center gap-3"
              >
                {/* Article Image / WikiOS Logomark Thumbnail Box */}
                <StashArticleThumbnail thumbUrl={thumbUrl} title={cleanTitle} />

                <div className="min-w-0 flex-1">
                  <h3 className="text-headline text-label group-hover/title:text-tint truncate transition-colors">
                    {cleanTitle}
                  </h3>
                  <div className="text-footnote text-label-secondary flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.savedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {annotations.length > 0 && (
                      <span className="py-0.2 bg-margin-accent/15 rounded-control-sm border-yellow/40 text-caption text-label flex items-center gap-1 border px-2 font-semibold">
                        <Highlighter className="h-2.5 w-2.5" />
                        {annotations.length} highlight{annotations.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {item.note && (
                      <span className="py-0.2 rounded-control-sm border-indigo/30 bg-indigo/15 text-caption text-indigo flex items-center gap-1 border px-2 font-semibold">
                        <StickyNote className="h-2.5 w-2.5" />
                        Note
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Action Buttons */}
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={withBasePath(`/wiki/${item.pageSlug}`)}
                  className="rounded-row border-separator bg-fill-4 text-caption text-label-secondary hover:bg-fill-4 hover:text-label flex items-center gap-1 border px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                  title="Read article"
                >
                  <span>Read</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>

                <Button
                  variant="bordered"
                  size="icon-sm"
                  aria-label="Remove from collection"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnstash(item.pageTitle, item.contentType);
                  }}
                  title="Remove from collection"
                  className="bg-fill-4 text-label-secondary hover:border-red/30 hover:bg-red/10 hover:text-red"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Custom User Note if present */}
            {item.note && <StashNote note={item.note} />}
          </div>
        );
      })}
    </div>
  );
}
