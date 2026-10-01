"use client";

/**
 * NationStates Deck Import Page
 *
 * Allows users to import their NationStates trading card deck into IxCards
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ImportWizard } from "~/components/cards/ns-import";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

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
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-large-title text-label mb-2">NationStates Deck Import</h1>
          <p className="text-label-secondary">
            Import your NationStates trading card collection into IxCards
          </p>
        </div>

        {!showWizard ? (
          <div className="border-separator bg-surface rounded-row space-y-6 border p-8">
            <div className="space-y-4">
              <h2 className="text-title-1 text-label">How It Works</h2>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                    1
                  </div>
                  <div>
                    <div className="text-label font-semibold">Verify Nation Ownership</div>
                    <div className="text-body text-label-secondary">
                      Prove you own your NationStates nation with a quick verification process
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                    2
                  </div>
                  <div>
                    <div className="text-label font-semibold">Preview Your Deck</div>
                    <div className="text-body text-label-secondary">
                      See your collection before importing - including total cards, rarity
                      distribution, and deck value
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                    3
                  </div>
                  <div>
                    <div className="text-label font-semibold">Import Your Cards</div>
                    <div className="text-body text-label-secondary">
                      Automatically import your entire deck with duplicate handling options
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-gold-400 text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                    4
                  </div>
                  <div>
                    <div className="text-label font-semibold">Earn Bonus Credits</div>
                    <div className="text-body text-label-secondary">
                      Get 10 IxCredits per card imported (max 500{" "}
                      <IxCreditsSymbol className="inline h-3.5 w-3.5 align-middle" /> bonus)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-control border-blue/20 bg-blue/10 border p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="text-blue mt-0.5 h-5 w-5 shrink-0"
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
                  <strong className="text-label">Note:</strong> You must own a NationStates nation
                  and have cards in your deck to import. The verification process ensures you own
                  the nation you're importing from.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowWizard(true)}
              className="rounded-control text-title-3 text-label hover:bg-fill-2 w-full px-6 py-4 font-semibold transition-colors"
            >
              Start Import Wizard
            </button>

            <div className="text-center">
              <button
                onClick={() => router.push("/vault")}
                className="text-body text-label-secondary hover:text-label transition-colors"
              >
                Back to MyVault
              </button>
            </div>

            <NationStatesAttribution className="text-center" />
          </div>
        ) : (
          <ImportWizard onComplete={handleImportComplete} onCancel={handleCancel} />
        )}
      </div>
    </div>
  );
}
