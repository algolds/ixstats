/**
 * LoreForumSection — Displays related XenForo forum threads for a lore card.
 * Used inside the Lore tab of CardDetailsModal.
 */

"use client";

import React from "react";
import { MessageCircle, ExternalLink } from "lucide-react";
import { api } from "~/trpc/react";

interface LoreForumSectionProps {
  articleTitle: string;
}

export const LoreForumSection = React.memo<LoreForumSectionProps>(
  ({ articleTitle }) => {
    const cleanTitle = articleTitle.replace(/_/g, " ");

    const { data: threads, isLoading } = api.cards.searchForumForCard.useQuery(
      { query: cleanTitle },
      { enabled: !!articleTitle, staleTime: 5 * 60 * 1000 }
    );

    const forumSearchUrl = `https://forum.ixwiki.com/search/?q=${encodeURIComponent(cleanTitle)}`;

    return (
      <div className="glass-hierarchy-child rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Forum Discussions
        </h4>

        {isLoading && (
          <div className="text-xs text-white/50">Searching forum...</div>
        )}

        {threads && threads.length > 0 ? (
          <div className="space-y-2">
            {threads.map((thread) => (
              <a
                key={thread.threadId}
                href={thread.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-white/5 p-3 hover:bg-white/10 transition-colors"
              >
                <div className="text-sm text-white font-medium">
                  {thread.title}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  by {thread.author} · {thread.replyCount} replies ·{" "}
                  {thread.viewCount} views
                </div>
              </a>
            ))}
          </div>
        ) : !isLoading ? (
          <div className="text-xs text-white/50">
            No forum discussions found for this article.
          </div>
        ) : null}

        <a
          href={forumSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <ExternalLink className="h-3 w-3" />
          Search forum for more discussions
        </a>
      </div>
    );
  }
);

LoreForumSection.displayName = "LoreForumSection";
