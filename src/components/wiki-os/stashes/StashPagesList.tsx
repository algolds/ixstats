// src/components/wiki-os/stashes/StashPagesList.tsx
// Saved wiki articles view with lead image thumbnail, WikiOS logomark, rich metadata, and quick actions.
// Full Apple Design & Facet compliance.

"use client";

import { useState } from "react";
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
import { soundEffects } from "~/lib/sound/cuelume";
import type { StashedPageItem } from "./types";

interface StashPagesListProps {
  items: StashedPageItem[];
  onUnstash: (pageTitle: string) => void;
  thumbnailsMap?: Record<string, string>;
}

function StashArticleThumbnail({
  thumbUrl,
  title,
}: {
  thumbUrl?: string | null;
  title: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!thumbUrl || hasError) {
    return (
      <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)] shadow-2xs group-hover/title:border-[var(--wikios-accent)] transition-all flex items-center justify-center text-[var(--wikios-accent)] opacity-85 group-hover/title:opacity-100">
        <WikiOSLogomark className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--wikios-surface)] border border-[var(--wikios-border)] shadow-2xs group-hover/title:border-[var(--wikios-accent)] transition-all">
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
            className="group relative rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 hover:bg-[var(--wikios-surface)]/90 hover:border-[var(--wikios-border)]/80 shadow-xs hover:shadow-md transition-all duration-200 backdrop-blur-xl p-4 overflow-hidden flex flex-col gap-3"
          >
            {/* Header Lockup & Title Link */}
            <div className="flex items-start justify-between gap-3">
              <Link
                href={withBasePath(`/wiki/${item.pageSlug}`)}
                onClick={() => soundEffects.press()}
                className="flex items-center gap-3 min-w-0 group/title flex-1"
              >
                {/* Article Image / WikiOS Logomark Thumbnail Box */}
                <StashArticleThumbnail thumbUrl={thumbUrl} title={cleanTitle} />

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[var(--wikios-text)] group-hover/title:text-[var(--wikios-accent)] transition-colors truncate tracking-tight">
                    {cleanTitle}
                  </h3>
                  <div className="flex items-center flex-wrap gap-2.5 text-[11px] text-[var(--wikios-text-dim)] pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.savedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {annotations.length > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.2 rounded-md bg-margin-accent/15 border border-yellow-400/40 text-stone-950 dark:text-margin-accent font-bold text-[10px]">
                        <Highlighter className="h-2.5 w-2.5" />
                        {annotations.length} highlight{annotations.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {item.note && (
                      <span className="flex items-center gap-1 px-2 py-0.2 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold text-[10px]">
                        <StickyNote className="h-2.5 w-2.5" />
                        Note
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={withBasePath(`/wiki/${item.pageSlug}`)}
                  onClick={() => soundEffects.press()}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)] px-2.5 py-1 rounded-xl bg-white/5 border border-[var(--wikios-border)] hover:bg-white/10 active:scale-95 transition-all shadow-2xs"
                  title="Read article"
                >
                  <span>Read</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEffects.release();
                    onUnstash(item.pageTitle);
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/5 border border-[var(--wikios-border)] text-[var(--wikios-text-dim)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="Remove from collection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Custom User Note if present */}
            {item.note && (
              <div
                className="p-3 rounded-xl bg-[var(--wikios-surface)]/70 border border-[var(--wikios-border)] text-xs text-[var(--wikios-text-muted)] leading-relaxed italic shadow-2xs"
                dangerouslySetInnerHTML={{
                  __html: sanitizeUserContent(item.note),
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
