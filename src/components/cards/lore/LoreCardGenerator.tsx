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
      // Fetch article preview from MediaWiki API
      const apiUrl =
        selectedWikiSource === "ixwiki"
          ? "https://ixwiki.com/api.php"
          : "https://iiwiki.com/mediawiki/api.php";

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", articleTitle);
      url.searchParams.set("prop", "extracts");
      url.searchParams.set("exintro", "1");
      url.searchParams.set("explaintext", "1");
      url.searchParams.set("origin", "*");

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error("Failed to fetch article preview");
        setArticlePreview("Failed to load article preview.");
        return;
      }

      const data = await response.json();
      const pages = data.query?.pages;

      if (pages) {
        const page = Object.values(pages)[0] as any;
        if (page.extract) {
          setArticlePreview(page.extract);
        } else {
          setArticlePreview("No preview available for this article.");
        }
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
        <label className="block text-sm font-medium text-white/90 mb-2">Wiki Source</label>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedWikiSource("ixwiki")}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
              selectedWikiSource === "ixwiki"
                ? "bg-gold-400 text-gray-900"
                : "glass-child text-white hover:bg-white/10"
            }`}
          >
            IxWiki
          </button>
          <button
            onClick={() => setSelectedWikiSource("iiwiki")}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
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
        <label className="block text-sm font-medium text-white/90 mb-2">Search Article</label>
        <ArticleSearch
          wikiSource={selectedWikiSource}
          onSelect={handleArticleSelect}
          value={selectedArticle}
        />
      </div>

      {/* Article Preview */}
      {selectedArticle && (
        <div className="glass-child p-4 rounded-lg">
          <h3 className="font-semibold text-white mb-2">{selectedArticle}</h3>

          {loadingPreview ? (
            <div className="text-sm text-white/60">Loading preview...</div>
          ) : (
            <div className="text-sm text-white/80 line-clamp-6">{articlePreview}</div>
          )}
        </div>
      )}

      {/* Cost Display */}
      <div className="glass-child p-4 rounded-lg bg-gold-500/10 border border-gold-400/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/60">Request Cost</div>
            <div className="text-2xl font-bold text-gold-400">50 IxC</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">Per lore card request</div>
            <div className="text-xs text-white/60 mt-1">Admin approval required</div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmitRequest}
        disabled={!selectedArticle || requestLoreCardMutation.isPending}
        className="w-full glass-interactive px-6 py-4 rounded-lg font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {requestLoreCardMutation.isPending ? "Submitting..." : "Request Lore Card (50 IxC)"}
      </button>

      {/* Recent Requests */}
      {myRequests.data && myRequests.data.requests.length > 0 && (
        <div className="glass-child p-4 rounded-lg">
          <h3 className="font-semibold text-white mb-3">Your Recent Requests</h3>

          <div className="space-y-2">
            {myRequests.data.requests.map((request) => (
              <div
                key={request.id}
                className="glass-child p-3 rounded-lg flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium text-white text-sm">{request.articleTitle}</div>
                  <div className="text-xs text-white/60 mt-1">
                    {request.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-xs font-semibold px-2 py-1 rounded ${
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
                  <div className="text-xs text-white/60 mt-1">
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {myRequests.data.total > 5 && (
            <div className="text-center mt-3">
              <button className="text-sm text-gold-400 hover:text-gold-300">
                View all ({myRequests.data.total} total)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
