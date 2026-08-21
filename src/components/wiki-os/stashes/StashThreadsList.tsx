// src/components/wiki-os/stashes/StashThreadsList.tsx
// Saved forum threads list.

"use client";

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { MessageSquare, Clock, ArrowRight, X } from "lucide-react";

interface StashedThreadItem {
  id: string;
  pageTitle: string;
  pageSlug: string;
  savedAt: string | Date;
  note?: string | null;
}

interface StashThreadsListProps {
  items: StashedThreadItem[];
  onUnstash: (pageTitle: string) => void;
}

export function StashThreadsList({ items, onUnstash }: StashThreadsListProps) {
  return (
    <div className="wikios-stashes-items">
      {items.map((item) => {
        const cleanTitle = item.note ?? item.pageTitle.replace("forum:thread:", "Thread #");
        return (
          <div key={item.id} className="wikios-stash-item-card">
            <Link href={withBasePath(item.pageSlug)} className="wikios-stash-item-link">
              <div className="wikios-stash-item-info">
                <span className="wikios-stash-item-title flex items-center gap-1.5">
                  <MessageSquare size={13} className="shrink-0 text-orange-500" />
                  {cleanTitle}
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
                </div>
              </div>
              <ArrowRight size={14} className="wikios-stash-item-arrow" />
            </Link>
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
        );
      })}
    </div>
  );
}
