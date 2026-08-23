// src/components/wiki-os/stashes/StashPagesList.tsx
// Saved wiki pages view with notes & highlight markers.

"use client";

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import {
  Clock,
  DesignPencil as Highlighter,
  Page as StickyNote,
  ArrowRight,
  Xmark as X,
} from "iconoir-react";
import { sanitizeUserContent } from "~/lib/utils";
import type { StashedPageItem } from "./types";

interface StashPagesListProps {
  items: StashedPageItem[];
  onUnstash: (pageTitle: string) => void;
}

export function StashPagesList({ items, onUnstash }: StashPagesListProps) {
  return (
    <div className="wikios-stashes-items">
      {items.map((item) => (
        <div key={item.id} className="wikios-stash-item-card">
          <Link href={withBasePath(`/wiki/${item.pageSlug}`)} className="wikios-stash-item-link">
            <div className="wikios-stash-item-info">
              <span className="wikios-stash-item-title">
                {item.pageTitle.replace(/_/g, " ")}
              </span>
              <div className="wikios-stash-item-meta">
                <span>
                  <Clock className="h-2.5 w-2.5 inline mr-1" />
                  {new Date(item.savedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {(item.annotationCount ?? 0) > 0 && (
                  <span className="wikios-stash-item-badge wikios-stash-item-badge-highlight">
                    <Highlighter className="h-2.5 w-2.5 inline mr-1" /> {item.annotationCount} highlight
                    {item.annotationCount !== 1 ? "s" : ""}
                  </span>
                )}
                {item.note && (
                  <span className="wikios-stash-item-badge wikios-stash-item-badge-note">
                    <StickyNote className="h-2.5 w-2.5 inline mr-1" /> Has note
                  </span>
                )}
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 wikios-stash-item-arrow" />
          </Link>
          {item.note && (
            <div
              className="wikios-stash-item-note"
              dangerouslySetInnerHTML={{
                __html: sanitizeUserContent(item.note),
              }}
            />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnstash(item.pageTitle);
            }}
            className="wikios-stash-item-remove"
            title="Remove from stash"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
