"use client";

/**
 * Lore Card Generator Page
 *
 * Interface for requesting lore cards from wiki articles
 * Users pay 50 IxCredits to request specific articles become lore cards
 * Admins review and approve requests
 */

import React from "react";
import { useRouter } from "next/navigation";
import { LoreCardGenerator } from "~/components/cards/lore";

export default function LoreGeneratorPage() {
  const router = useRouter();

  const handleRequestSubmitted = (requestId: string) => {
    console.log("Lore card request submitted:", requestId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-blue-900/20 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Wiki Lore Card Generator</h1>
          <p className="text-white/70">
            Request custom lore cards from IxWiki and IIWiki articles
          </p>
        </div>

        {/* Info Panel */}
        <div className="glass-parent p-6 mb-6 space-y-4">
          <h2 className="text-2xl font-bold text-white">How It Works</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-400 text-gray-900 font-bold flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div>
                <div className="font-semibold text-white">Search for an Article</div>
                <div className="text-sm text-white/60">
                  Find interesting wiki articles from IxWiki or IIWiki
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-400 text-gray-900 font-bold flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div>
                <div className="font-semibold text-white">Submit Your Request</div>
                <div className="text-sm text-white/60">
                  Pay 50 IxCredits to request the article become a lore card
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-400 text-gray-900 font-bold flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div>
                <div className="font-semibold text-white">Admin Review</div>
                <div className="text-sm text-white/60">
                  Admins review your request for quality and appropriateness
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-400 text-gray-900 font-bold flex items-center justify-center flex-shrink-0">
                4
              </div>
              <div>
                <div className="font-semibold text-white">Card Generation</div>
                <div className="text-sm text-white/60">
                  Once approved, the system automatically generates your lore card with quality-based rarity
                </div>
              </div>
            </div>
          </div>

          <div className="glass-child p-4 rounded-lg bg-indigo-500/10 border border-indigo-400/20">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-white/80">
                <strong className="text-white">Lore Card Quality:</strong> Card rarity is
                determined by article quality metrics including length, references, inbound links,
                categories, infoboxes, and featured status. Higher quality articles generate rarer
                cards!
              </div>
            </div>
          </div>

          <div className="glass-child p-4 rounded-lg bg-yellow-500/10 border border-yellow-400/20">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-white/80">
                <strong className="text-white">Refund Policy:</strong> If your request is rejected
                by admins, you'll receive a full refund of 50 IxCredits. Requests are only rejected
                for quality or appropriateness concerns.
              </div>
            </div>
          </div>
        </div>

        {/* Generator Interface */}
        <div className="glass-parent p-8">
          <LoreCardGenerator onRequestSubmitted={handleRequestSubmitted} />
        </div>

        {/* Back Button */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/vault")}
            className="text-white/60 hover:text-white transition-colors text-sm"
          >
            Back to MyVault
          </button>
        </div>
      </div>
    </div>
  );
}
