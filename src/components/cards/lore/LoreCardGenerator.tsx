"use client";

/**
 * LoreCardGenerator Component
 *
 * Main interface for generating lore cards from wiki articles
 *
 * Features:
 * - Article search and preview
 * - Cost display (50 IxC)
 * - Card generation request submission
 * - Request queue status
 */

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { ArticleSearch } from "./ArticleSearch";

interface LoreCardGeneratorProps {
  onRequestSubmitted?: (requestId: string) => void;
}

type WikiSource = "ixwiki" | "iiwiki";

export function LoreCardGenerator({ onRequestSubmitted }: LoreCardGeneratorProps) {
  const [selectedWikiSource, setSelectedWikiSource] = useState<WikiSource>("ixwiki");
  const [selectedArticle, setSelectedArticle] = useState<string>("");
  const [articlePreview, setArticlePreview] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const utils = api.useUtils();
  const requestLoreCardMutation = api.loreCards.requestLoreCard.useMutation({
    onSuccess: () => {
      utils.loreCards.getMyRequests.invalidate();
    },
  });

  const myRequests = api.loreCards.getMyRequests.useQuery({
    limit: 5,
    offset: 0,
  });

  const handleArticleSelect = async (articleTitle: string) => {
    setSelectedArticle(articleTitle);
    setLoadingPreview(true);

    try {
      // Fetch article preview via WikiBridge (tRPC endpoint)
      const result = await utils.cards.getWikiArticleExcerpt.fetch({
        articleTitle,
        wikiSource: selectedWikiSource,
      });

      if (result?.extract) {
        setArticlePreview(result.extract);
      } else {
        setArticlePreview("No preview available for this article.");
      }
    } catch (error) {
      console.error("Error fetching article preview:", error);
      setArticlePreview("Failed to load article preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedArticle) {
      alert("Please select an article first");
      return;
    }

    try {
      const result = await requestLoreCardMutation.mutateAsync({
        articleTitle: selectedArticle,
        wikiSource: selectedWikiSource,
      });

      alert(result.message);
      onRequestSubmitted?.(result.requestId);

      // Clear selection
      setSelectedArticle("");
      setArticlePreview("");
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to submit lore card request";
      alert(errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wiki Source Selection */}
      <div>
        <label className="mb-2 block text-sm font-medium text-white/90">Wiki Source</label>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedWikiSource("ixwiki")}
            className={`flex-1 rounded-lg px-4 py-3 font-semibold transition-colors ${
              selectedWikiSource === "ixwiki"
                ? "bg-gold-400 text-gray-900"
                : "glass-child text-white hover:bg-white/10"
            }`}
          >
            IxWiki
          </button>
          <button
            onClick={() => setSelectedWikiSource("iiwiki")}
            className={`flex-1 rounded-lg px-4 py-3 font-semibold transition-colors ${
              selectedWikiSource === "iiwiki"
                ? "bg-gold-400 text-gray-900"
                : "glass-child text-white hover:bg-white/10"
            }`}
          >
            IIWiki
          </button>
        </div>
      </div>

      {/* Article Search */}
      <div>
        <label className="mb-2 block text-sm font-medium text-white/90">Search Article</label>
        <ArticleSearch
          wikiSource={selectedWikiSource}
          onSelect={handleArticleSelect}
          value={selectedArticle}
        />
      </div>

      {/* Article Preview */}
      {selectedArticle && (
        <div className="glass-child rounded-lg p-4">
          <h3 className="mb-2 font-semibold text-white">{selectedArticle}</h3>

          {loadingPreview ? (
            <div className="text-sm text-white/60">Loading preview...</div>
          ) : (
            <div className="line-clamp-6 text-sm text-white/80">{articlePreview}</div>
          )}
        </div>
      )}

      {/* Cost Display */}
      <div className="glass-child bg-gold-500/10 border-gold-400/20 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/60">Request Cost</div>
            <div className="text-gold-400 text-2xl font-bold">50 IxC</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">Per lore card request</div>
            <div className="mt-1 text-xs text-white/60">Admin approval required</div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmitRequest}
        disabled={!selectedArticle || requestLoreCardMutation.isPending}
        className="glass-interactive w-full rounded-lg px-6 py-4 font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {requestLoreCardMutation.isPending ? "Submitting..." : "Request Lore Card (50 IxC)"}
      </button>

      {/* Recent Requests */}
      {myRequests.data && myRequests.data.requests.length > 0 && (
        <div className="glass-child rounded-lg p-4">
          <h3 className="mb-3 font-semibold text-white">Your Recent Requests</h3>

          <div className="space-y-2">
            {myRequests.data.requests.map((request: any) => (
              <div
                key={request.id}
                className="glass-child flex items-center justify-between rounded-lg p-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{request.articleTitle}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {request.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      request.status === "PENDING"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : request.status === "APPROVED"
                          ? "bg-blue-500/20 text-blue-400"
                          : request.status === "GENERATED"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {request.status}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {myRequests.data.total > 5 && (
            <div className="mt-3 text-center">
              <button className="text-gold-400 hover:text-gold-300 text-sm">
                View all ({myRequests.data.total} total)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
