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

function StashArticleThumbnail({ thumbUrl, title }: { thumbUrl?: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);

  if (!thumbUrl || hasError) {
    return (
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-[var(--wikios-accent)] opacity-85 shadow-2xs transition-all group-hover/title:border-[var(--wikios-accent)] group-hover/title:opacity-100 sm:h-14 sm:w-14">
        <WikiOSLogomark className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] shadow-2xs transition-all group-hover/title:border-[var(--wikios-accent)] sm:h-14 sm:w-14">
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
            className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-4 shadow-xs backdrop-blur-xl transition-all duration-200 hover:border-[var(--wikios-border)]/80 hover:bg-[var(--wikios-surface)]/90 hover:shadow-md"
          >
            {/* Header Lockup & Title Link */}
            <div className="flex items-start justify-between gap-3">
              <Link
                href={withBasePath(`/wiki/${item.pageSlug}`)}
                onClick={() => soundEffects.press()}
                className="group/title flex min-w-0 flex-1 items-center gap-3"
              >
                {/* Article Image / WikiOS Logomark Thumbnail Box */}
                <StashArticleThumbnail thumbUrl={thumbUrl} title={cleanTitle} />

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold tracking-tight text-[var(--wikios-text)] transition-colors group-hover/title:text-[var(--wikios-accent)]">
                    {cleanTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2.5 pt-0.5 text-[11px] text-[var(--wikios-text-dim)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.savedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {annotations.length > 0 && (
                      <span className="py-0.2 bg-margin-accent/15 dark:text-margin-accent flex items-center gap-1 rounded-md border border-yellow-400/40 px-2 text-[10px] font-bold text-stone-950">
                        <Highlighter className="h-2.5 w-2.5" />
                        {annotations.length} highlight{annotations.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {item.note && (
                      <span className="py-0.2 flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/15 px-2 text-[10px] font-bold text-purple-400">
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
                  onClick={() => soundEffects.press()}
                  className="flex items-center gap-1 rounded-xl border border-[var(--wikios-border)] bg-white/5 px-2.5 py-1 text-xs font-semibold text-[var(--wikios-text-muted)] shadow-2xs transition-all hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-95"
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
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] shadow-2xs transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95"
                  title="Remove from collection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Custom User Note if present */}
            {item.note && (
              <div
                className="rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/70 p-3 text-xs leading-relaxed text-[var(--wikios-text-muted)] italic shadow-2xs"
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
