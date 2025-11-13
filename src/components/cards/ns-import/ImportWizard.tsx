"use client";

/**
 * ImportWizard Component
 *
 * Multi-step wizard for importing NationStates trading cards
 *
 * Steps:
 * 1. Nation Name & Verification
 * 2. Deck Preview
 * 3. Duplicate Handling Options
 * 4. Import Progress
 * 5. Import Summary
 */

import React, { useState } from "react";
import { api } from "~/trpc/react";
import type { NSCard } from "~/lib/ns-api-client";

interface ImportWizardProps {
  onComplete: (results: ImportResults) => void;
  onCancel: () => void;
}

interface ImportResults {
  cardsImported: number;
  cardsSkipped: number;
  bonusCredits: number;
  nation: string;
}

type WizardStep = "auth" | "preview" | "options" | "progress" | "summary";

export function ImportWizard({ onComplete, onCancel }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("auth");
  const [nationName, setNationName] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [checksum, setChecksum] = useState("");
  const [deckData, setDeckData] = useState<{
    nation: string;
    cards: NSCard[];
    totalCards: number;
    uniqueCards: number;
    deckValue: number;
  } | null>(null);
  const [duplicateOption, setDuplicateOption] = useState<"skip" | "merge">("skip");
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  const utils = api.useUtils();
  const requestVerificationMutation = api.nsImport.requestVerification.useMutation();
  const checkVerificationMutation = api.nsImport.checkVerification.useMutation();
  const importDeckMutation = api.nsImport.importDeck.useMutation();

  const handleRequestVerification = async () => {
    if (!nationName.trim()) {
      alert("Please enter a nation name");
      return;
    }

    try {
      const result = await requestVerificationMutation.mutateAsync({
        nationName: nationName.trim(),
      });

      setVerificationId(result.verificationId);

      // Open verification URL in new window
      window.open(result.verificationUrl, "_blank");
    } catch (error) {
      console.error("Failed to request verification:", error);
      alert("Failed to request verification. Please try again.");
    }
  };

  const handleCheckVerification = async () => {
    if (!verificationId || !checksum.trim()) {
      alert("Please enter your verification code");
      return;
    }

    try {
      const result = await checkVerificationMutation.mutateAsync({
        verificationId,
        checksum: checksum.trim(),
      });

      if (result.verified) {
        // Fetch deck preview
        const deck = await utils.nsImport.fetchPublicDeck.fetch({
          nationName: nationName.trim(),
        });

        setDeckData(deck);
        setCurrentStep("preview");
      } else {
        alert("Verification failed. Please check your code and try again.");
      }
    } catch (error) {
      console.error("Verification check failed:", error);
      alert("Verification failed. Please try again.");
    }
  };

  const handleProceedToOptions = () => {
    setCurrentStep("options");
  };

  const handleStartImport = async () => {
    if (!verificationId) {
      alert("Verification required");
      return;
    }

    setCurrentStep("progress");

    try {
      const result = await importDeckMutation.mutateAsync({
        verificationId,
      });

      setImportResults({
        cardsImported: result.cardsImported,
        cardsSkipped: result.cardsSkipped,
        bonusCredits: result.bonusCredits,
        nation: result.nation,
      });

      setCurrentStep("summary");
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import failed. Please try again.");
      setCurrentStep("options");
    }
  };

  const handleComplete = () => {
    if (importResults) {
      onComplete(importResults);
    }
  };

  return (
    <div className="glass-parent min-h-[600px] p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {["auth", "preview", "options", "progress", "summary"].map((step, idx) => (
            <div
              key={step}
              className={`flex items-center ${idx > 0 ? "flex-1" : ""}`}
            >
              {idx > 0 && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    ["auth", "preview", "options", "progress", "summary"].indexOf(currentStep) > idx - 1
                      ? "bg-gold-400"
                      : "bg-white/20"
                  }`}
                />
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  ["auth", "preview", "options", "progress", "summary"].indexOf(currentStep) >= idx
                    ? "bg-gold-400 text-gray-900"
                    : "bg-white/20 text-white/60"
                }`}
              >
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-white/60">
          <span>Verify</span>
          <span>Preview</span>
          <span>Options</span>
          <span>Import</span>
          <span>Done</span>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === "auth" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 1: Verify Nation Ownership</h2>
          <p className="text-white/80">
            Enter your NationStates nation name to begin the import process.
          </p>

          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Nation Name
            </label>
            <input
              type="text"
              value={nationName}
              onChange={(e) => setNationName(e.target.value)}
              className="glass-child w-full px-4 py-2 rounded-lg text-white placeholder-white/40"
              placeholder="Enter nation name"
            />
          </div>

          {!verificationId ? (
            <button
              onClick={handleRequestVerification}
              disabled={requestVerificationMutation.isPending}
              className="w-full glass-interactive px-6 py-3 rounded-lg font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              {requestVerificationMutation.isPending ? "Requesting..." : "Request Verification"}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="glass-child p-4 rounded-lg">
                <p className="text-sm text-white/80 mb-2">
                  A verification window has been opened. Copy your verification code and paste it below.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  className="glass-child w-full px-4 py-2 rounded-lg text-white placeholder-white/40"
                  placeholder="Paste verification code"
                />
              </div>

              <button
                onClick={handleCheckVerification}
                disabled={checkVerificationMutation.isPending}
                className="w-full glass-interactive px-6 py-3 rounded-lg font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                {checkVerificationMutation.isPending ? "Verifying..." : "Verify & Continue"}
              </button>
            </div>
          )}

          <button
            onClick={onCancel}
            className="w-full px-6 py-3 rounded-lg font-semibold text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {currentStep === "preview" && deckData && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 2: Deck Preview</h2>
          <p className="text-white/80">
            Review your NationStates deck before importing.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-child p-4 rounded-lg">
              <div className="text-sm text-white/60">Total Cards</div>
              <div className="text-2xl font-bold text-white">{deckData.totalCards}</div>
            </div>
            <div className="glass-child p-4 rounded-lg">
              <div className="text-sm text-white/60">Unique Cards</div>
              <div className="text-2xl font-bold text-white">{deckData.uniqueCards}</div>
            </div>
            <div className="glass-child p-4 rounded-lg col-span-2">
              <div className="text-sm text-white/60">Deck Value</div>
              <div className="text-2xl font-bold text-gold-400">{deckData.deckValue.toFixed(2)} Bank</div>
            </div>
          </div>

          <div className="glass-child p-4 rounded-lg max-h-96 overflow-y-auto">
            <h3 className="font-semibold text-white mb-4">Cards (showing first 20)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {deckData.cards.slice(0, 20).map((card, idx) => (
                <div key={idx} className="glass-child p-3 rounded-lg text-center">
                  <div className="text-xs font-semibold text-white/90 truncate">{card.name || `Card ${card.id}`}</div>
                  <div className="text-xs text-white/60 mt-1">{card.rarity}</div>
                  {card.quantity && card.quantity > 1 && (
                    <div className="text-xs text-gold-400 mt-1">x{card.quantity}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentStep("auth")}
              className="flex-1 px-6 py-3 rounded-lg font-semibold text-white/60 hover:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleProceedToOptions}
              className="flex-1 glass-interactive px-6 py-3 rounded-lg font-semibold text-white hover:bg-white/20 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {currentStep === "options" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 3: Import Options</h2>
          <p className="text-white/80">
            Choose how to handle duplicate cards.
          </p>

          <div className="space-y-3">
            <label className="glass-child p-4 rounded-lg flex items-start gap-3 cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="radio"
                name="duplicateOption"
                value="skip"
                checked={duplicateOption === "skip"}
                onChange={(e) => setDuplicateOption(e.target.value as "skip" | "merge")}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-white">Skip Duplicates</div>
                <div className="text-sm text-white/60">
                  Don't import cards you already own. Faster and cleaner.
                </div>
              </div>
            </label>

            <label className="glass-child p-4 rounded-lg flex items-start gap-3 cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="radio"
                name="duplicateOption"
                value="merge"
                checked={duplicateOption === "merge"}
                onChange={(e) => setDuplicateOption(e.target.value as "skip" | "merge")}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-white">Merge Duplicates</div>
                <div className="text-sm text-white/60">
                  Update existing cards with latest NS data. Recommended for syncing.
                </div>
              </div>
            </label>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentStep("preview")}
              className="flex-1 px-6 py-3 rounded-lg font-semibold text-white/60 hover:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleStartImport}
              className="flex-1 glass-interactive px-6 py-3 rounded-lg font-semibold text-white hover:bg-white/20 transition-colors"
            >
              Start Import
            </button>
          </div>
        </div>
      )}

      {currentStep === "progress" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 4: Importing...</h2>
          <p className="text-white/80">
            Please wait while we import your cards. This may take a few moments.
          </p>

          <div className="glass-child p-8 rounded-lg text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-gold-400 mx-auto mb-4"></div>
            <div className="text-lg font-semibold text-white">Importing your deck...</div>
            <div className="text-sm text-white/60 mt-2">This may take a minute</div>
          </div>
        </div>
      )}

      {currentStep === "summary" && importResults && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 5: Import Complete!</h2>
          <p className="text-white/80">
            Your NationStates deck has been successfully imported.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-child p-4 rounded-lg">
              <div className="text-sm text-white/60">Cards Imported</div>
              <div className="text-2xl font-bold text-green-400">{importResults.cardsImported}</div>
            </div>
            <div className="glass-child p-4 rounded-lg">
              <div className="text-sm text-white/60">Cards Skipped</div>
              <div className="text-2xl font-bold text-white/60">{importResults.cardsSkipped}</div>
            </div>
            <div className="glass-child p-4 rounded-lg col-span-2">
              <div className="text-sm text-white/60">Bonus Credits Earned</div>
              <div className="text-2xl font-bold text-gold-400">{importResults.bonusCredits} IxC</div>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="w-full glass-interactive px-6 py-3 rounded-lg font-semibold text-white hover:bg-white/20 transition-colors"
          >
            View My Collection
          </button>
        </div>
      )}
    </div>
  );
}
