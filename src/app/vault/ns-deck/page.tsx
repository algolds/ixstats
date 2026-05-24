"use client";

/**
 * NationStates Deck Import Page
 *
 * Allows users to import their NationStates trading card deck into IxCards
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ImportWizard } from "~/components/cards/ns-import";

export default function NSImportPage() {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);

  const handleImportComplete = (results: {
    cardsImported: number;
    cardsSkipped: number;
    bonusCredits: number;
    nation: string;
  }) => {
    console.log("Import completed:", results);
    // Navigate to inventory after successful import
    router.push("/vault/inventory");
  };

  const handleCancel = () => {
    setShowWizard(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-indigo-900/20 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-white">NationStates Deck Import</h1>
          <p className="text-white/70">
            Import your NationStates trading card collection into IxCards
          </p>
        </div>

        {!showWizard ? (
          <div className="glass-parent space-y-6 p-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">How It Works</h2>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-gray-900">
                    1
                  </div>
                  <div>
                    <div className="font-semibold text-white">Verify Nation Ownership</div>
                    <div className="text-sm text-white/60">
                      Prove you own your NationStates nation with a quick verification process
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-gray-900">
                    2
                  </div>
                  <div>
                    <div className="font-semibold text-white">Preview Your Deck</div>
                    <div className="text-sm text-white/60">
                      See your collection before importing - including total cards, rarity
                      distribution, and deck value
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-gray-900">
                    3
                  </div>
                  <div>
                    <div className="font-semibold text-white">Import Your Cards</div>
                    <div className="text-sm text-white/60">
                      Automatically import your entire deck with duplicate handling options
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-gray-900">
                    4
                  </div>
                  <div>
                    <div className="font-semibold text-white">Earn Bonus Credits</div>
                    <div className="text-sm text-white/60">
                      Get 10 IxCredits per card imported (max 500 IxC bonus)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-child rounded-lg border border-blue-400/20 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400"
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
                  <strong className="text-white">Note:</strong> You must own a NationStates nation
                  and have cards in your deck to import. The verification process ensures you own
                  the nation you're importing from.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowWizard(true)}
              className="glass-interactive w-full rounded-lg px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/20"
            >
              Start Import Wizard
            </button>

            <div className="text-center">
              <button
                onClick={() => router.push("/vault")}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                Back to MyVault
              </button>
            </div>
          </div>
        ) : (
          <ImportWizard onComplete={handleImportComplete} onCancel={handleCancel} />
        )}
      </div>
    </div>
  );
}
