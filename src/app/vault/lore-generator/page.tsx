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
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-large-title text-label mb-2">Wiki Lore Card Generator</h1>
          <p className="text-label-secondary">
            Request custom lore cards from IxWiki and IIWiki articles
          </p>
        </div>

        {/* Info Panel */}
        <div className="border-separator bg-surface rounded-row mb-6 space-y-4 border p-6">
          <h2 className="text-title-1 text-label">How It Works</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-indigo text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                1
              </div>
              <div>
                <div className="text-label font-semibold">Search for an Article</div>
                <div className="text-body text-label-secondary">
                  Find interesting wiki articles from IxWiki or IIWiki
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-indigo text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                2
              </div>
              <div>
                <div className="text-label font-semibold">Submit Your Request</div>
                <div className="text-body text-label-secondary">
                  Pay 50 IxCredits to request the article become a lore card
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-indigo text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                3
              </div>
              <div>
                <div className="text-label font-semibold">Admin Review</div>
                <div className="text-body text-label-secondary">
                  Admins review your request for quality and appropriateness
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-indigo text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                4
              </div>
              <div>
                <div className="text-label font-semibold">Card Generation</div>
                <div className="text-body text-label-secondary">
                  Once approved, the system automatically generates your lore card with
                  quality-based rarity
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-control border-indigo/20 bg-indigo/10 border p-4">
            <div className="flex items-start gap-3">
              <svg
                className="text-indigo mt-0.5 h-5 w-5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-body text-label">
                <strong className="text-label">Lore Card Quality:</strong> Card rarity is determined
                by article quality metrics including length, references, inbound links, categories,
                infoboxes, and featured status. Higher quality articles generate rarer cards!
              </div>
            </div>
          </div>

          <div className="rounded-control border-yellow/20 bg-yellow/10 border p-4">
            <div className="flex items-start gap-3">
              <svg
                className="text-yellow mt-0.5 h-5 w-5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-body text-label">
                <strong className="text-label">Refund Policy:</strong> If your request is rejected
                by admins, you'll receive a full refund of 50 IxCredits. Requests are only rejected
                for quality or appropriateness concerns.
              </div>
            </div>
          </div>
        </div>

        {/* Generator Interface */}
        <div className="border-separator bg-surface rounded-row border p-8">
          <LoreCardGenerator onRequestSubmitted={handleRequestSubmitted} />
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/vault")}
            className="text-body text-label-secondary hover:text-label transition-colors"
          >
            Back to MyVault
          </button>
        </div>
      </div>
    </div>
  );
}
