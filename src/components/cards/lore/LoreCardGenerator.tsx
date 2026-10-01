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

import { useNotify } from "~/hooks/useNotify";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import { ArticleSearch } from "./ArticleSearch";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

interface LoreCardGeneratorProps {
  onRequestSubmitted?: (requestId: string) => void;
}

type WikiSource = "ixwiki" | "iiwiki";

export function LoreCardGenerator({ onRequestSubmitted }: LoreCardGeneratorProps) {
  const notify = useNotify();
  const [selectedWikiSource, setSelectedWikiSource] = useState<WikiSource>("ixwiki");
  const [selectedArticle, setSelectedArticle] = useState<string>("");
  const [articlePreview, setArticlePreview] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const { data: tokenData } = api.loreCards.getLoreTokensBalance.useQuery(undefined, {
    staleTime: 30000,
  });
  const tokenBalance = tokenData?.balance ?? 0;

  const utils = api.useUtils();
  const requestLoreCardMutation = api.loreCards.requestLoreCard.useMutation({
    onSuccess: () => {
      utils.loreCards.getMyRequests.invalidate();
      utils.loreCards.getLoreTokensBalance.invalidate();
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
      notify.error("Please select an article first");
      return;
    }

    try {
      const result = await requestLoreCardMutation.mutateAsync({
        articleTitle: selectedArticle,
        wikiSource: selectedWikiSource,
      });

      notify.success(result.message);
      onRequestSubmitted?.(result.requestId);

      // Clear selection
      setSelectedArticle("");
      setArticlePreview("");
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to submit lore card request";
      notify.error(errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wiki Source Selection */}
      <div>
        <label className="text-body text-label mb-2 block font-medium">Wiki Source</label>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedWikiSource("ixwiki")}
            className={`rounded-control flex-1 px-4 py-3 font-semibold transition-colors ${
              selectedWikiSource === "ixwiki" ? "bg-gold-400 text-label" : "bg-fill-3 text-label"
            }`}
          >
            IxWiki
          </button>
          <button
            onClick={() => setSelectedWikiSource("iiwiki")}
            className={`rounded-control flex-1 px-4 py-3 font-semibold transition-colors ${
              selectedWikiSource === "iiwiki" ? "bg-gold-400 text-label" : "bg-fill-3 text-label"
            }`}
          >
            IIWiki
          </button>
        </div>
      </div>

      {/* Article Search */}
      <div>
        <label className="text-body text-label mb-2 block font-medium">Search Article</label>
        <ArticleSearch
          wikiSource={selectedWikiSource}
          onSelect={handleArticleSelect}
          value={selectedArticle}
        />
      </div>

      {/* Article Preview */}
      {selectedArticle && (
        <div className="bg-fill-3 rounded-control p-4">
          <h3 className="text-label mb-2 font-semibold">{selectedArticle}</h3>

          {loadingPreview ? (
            <div className="text-body text-label-secondary">Loading preview...</div>
          ) : (
            <div className="text-body text-label line-clamp-6">{articlePreview}</div>
          )}
        </div>
      )}

      {/* Cost Display */}
      <div className="bg-gold-500/10 border-gold-400/20 rounded-control border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-body text-label-secondary">Request Cost</div>
            {tokenBalance > 0 ? (
              <div className="text-gold-400 text-title-1">Free (Token Available)</div>
            ) : (
              <div className="text-gold-400 text-title-1 flex items-center gap-1">
                <IxCreditsSymbol className="text-yellow h-6 w-6 shrink-0" />
                50
              </div>
            )}
          </div>
          <div className="text-right">
            {tokenBalance > 0 ? (
              <div className="text-footnote text-green text-label-secondary font-semibold">
                Lore Token Balance: {tokenBalance}
              </div>
            ) : (
              <div className="text-footnote text-label-secondary">Per lore card request</div>
            )}
            <div className="text-footnote text-label-secondary mt-1">Admin approval required</div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmitRequest}
        disabled={!selectedArticle || requestLoreCardMutation.isPending}
        className="rounded-control text-label hover:bg-fill-2 w-full px-6 py-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {requestLoreCardMutation.isPending ? (
          "Submitting..."
        ) : tokenBalance > 0 ? (
          "Request Lore Card (Free with Token)"
        ) : (
          <span className="inline-flex items-center justify-center gap-1.5">
            Request Lore Card (50 <IxCreditsSymbol className="h-4 w-4 shrink-0" />)
          </span>
        )}
      </button>

      {/* Recent Requests */}
      {myRequests.data && myRequests.data.requests.length > 0 && (
        <div className="bg-fill-3 rounded-control p-4">
          <h3 className="text-label mb-3 font-semibold">Your Recent Requests</h3>

          <div className="space-y-2">
            {myRequests.data.requests.map((request: any) => (
              <div
                key={request.id}
                className="bg-fill-3 rounded-control flex items-center justify-between p-3"
              >
                <div className="flex-1">
                  <div className="text-body text-label font-medium">{request.articleTitle}</div>
                  <div className="text-footnote text-label-secondary mt-1">
                    {request.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-footnote rounded px-2 py-1 font-semibold ${
                      request.status === "PENDING"
                        ? "bg-yellow/20 text-yellow"
                        : request.status === "APPROVED"
                          ? "bg-blue/20 text-blue"
                          : request.status === "GENERATED"
                            ? "bg-green/20 text-green"
                            : "bg-red/20 text-red"
                    }`}
                  >
                    {request.status}
                  </div>
                  <div className="text-footnote text-label-secondary mt-1">
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {myRequests.data.total > 5 && (
            <div className="mt-3 text-center">
              <button className="text-gold-400 hover:text-gold-300 text-body">
                View all ({myRequests.data.total} total)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
