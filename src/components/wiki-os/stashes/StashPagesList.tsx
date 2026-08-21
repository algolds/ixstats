// src/components/wiki-os/stashes/StashPagesList.tsx
// Saved wiki pages view with notes & highlight markers.

"use client";

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { Clock, Highlighter, StickyNote, ArrowRight, X } from "lucide-react";
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
                  <Clock size={10} />{" "}
                  {new Date(item.savedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {(item.annotationCount ?? 0) > 0 && (
                  <span className="wikios-stash-item-badge wikios-stash-item-badge-highlight">
                    <Highlighter size={10} /> {item.annotationCount} highlight
                    {item.annotationCount !== 1 ? "s" : ""}
                  </span>
                )}
                {item.note && (
                  <span className="wikios-stash-item-badge wikios-stash-item-badge-note">
                    <StickyNote size={10} /> Has note
                  </span>
                )}
              </div>
            </div>
            <ArrowRight size={14} className="wikios-stash-item-arrow" />
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
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
