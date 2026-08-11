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
  const [hasGrantedConsent, setHasGrantedConsent] = useState(false);
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

    if (!hasGrantedConsent) {
      alert("Please confirm your first-party content permission to proceed with the import.");
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
        <div className="mb-2 flex items-center justify-between">
          {["auth", "preview", "options", "progress", "summary"].map((step, idx) => (
            <div key={step} className={`flex items-center ${idx > 0 ? "flex-1" : ""}`}>
              {idx > 0 && (
                <div
                  className={`mx-2 h-1 flex-1 ${
                    ["auth", "preview", "options", "progress", "summary"].indexOf(currentStep) >
                    idx - 1
                      ? "bg-gold-400"
                      : "bg-white/20"
                  }`}
                />
              )}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
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
            <label className="mb-2 block text-sm font-medium text-white/90">Nation Name</label>
            <input
              type="text"
              value={nationName}
              onChange={(e) => setNationName(e.target.value)}
              className="glass-child w-full rounded-lg px-4 py-2 text-white placeholder-white/40"
              placeholder="Enter nation name"
            />
          </div>

          {!verificationId ? (
            <button
              onClick={handleRequestVerification}
              disabled={requestVerificationMutation.isPending}
              className="glass-interactive w-full rounded-lg px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              {requestVerificationMutation.isPending ? "Requesting..." : "Request Verification"}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="glass-child rounded-lg p-4">
                <p className="mb-2 text-sm text-white/80">
                  A verification window has been opened. Copy your verification code and paste it
                  below.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/90">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  className="glass-child w-full rounded-lg px-4 py-2 text-white placeholder-white/40"
                  placeholder="Paste verification code"
                />
              </div>

              <button
                onClick={handleCheckVerification}
                disabled={checkVerificationMutation.isPending}
                className="glass-interactive w-full rounded-lg px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                {checkVerificationMutation.isPending ? "Verifying..." : "Verify & Continue"}
              </button>
            </div>
          )}

          <button
            onClick={onCancel}
            className="w-full rounded-lg px-6 py-3 font-semibold text-white/60 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {currentStep === "preview" && deckData && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 2: Deck Preview</h2>
          <p className="text-white/80">Review your NationStates deck before importing.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-child rounded-lg p-4">
              <div className="text-sm text-white/60">Total Cards</div>
              <div className="text-2xl font-bold text-white">{deckData.totalCards}</div>
            </div>
            <div className="glass-child rounded-lg p-4">
              <div className="text-sm text-white/60">Unique Cards</div>
              <div className="text-2xl font-bold text-white">{deckData.uniqueCards}</div>
            </div>
            <div className="glass-child col-span-2 rounded-lg p-4">
              <div className="text-sm text-white/60">Deck Value</div>
              <div className="text-gold-400 text-2xl font-bold">
                {deckData.deckValue.toFixed(2)} Bank
              </div>
            </div>
          </div>

          <div className="glass-child max-h-96 overflow-y-auto rounded-lg p-4">
            <h3 className="mb-4 font-semibold text-white">Cards (showing first 20)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {deckData.cards.slice(0, 20).map((card, idx) => (
                <div key={idx} className="glass-child rounded-lg p-3 text-center">
                  <div className="truncate text-xs font-semibold text-white/90">
                    {card.name || `Card ${card.id}`}
                  </div>
                  <div className="mt-1 text-xs text-white/60">{card.rarity}</div>
                  {card.quantity && card.quantity > 1 && (
                    <div className="text-gold-400 mt-1 text-xs">x{card.quantity}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentStep("auth")}
              className="flex-1 rounded-lg px-6 py-3 font-semibold text-white/60 transition-colors hover:text-white"
            >
              Back
            </button>
            <button
              onClick={handleProceedToOptions}
              className="glass-interactive flex-1 rounded-lg px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {currentStep === "options" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 3: Import Options</h2>
          <p className="text-white/80">Choose how to handle duplicate cards.</p>

          <div className="space-y-3">
            <label className="glass-child flex cursor-pointer items-start gap-3 rounded-lg p-4 transition-colors hover:bg-white/10">
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

            <label className="glass-child flex cursor-pointer items-start gap-3 rounded-lg p-4 transition-colors hover:bg-white/10">
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

          <div className="glass-child rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={hasGrantedConsent}
                onChange={(e) => setHasGrantedConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/30 text-amber-400 focus:ring-amber-400"
              />
              <div className="text-sm text-white/90">
                <span className="font-semibold text-white">First-Party Content Permission & Grant:</span>{" "}
                I verify that I am the owner or authorized operator of <strong>{nationName || "this nation"}</strong> on NationStates, and I grant permission to display my nation's flag and card representation on IxCards.
              </div>
            </label>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentStep("preview")}
              className="flex-1 rounded-lg px-6 py-3 font-semibold text-white/60 transition-colors hover:text-white"
            >
              Back
            </button>
            <button
              onClick={handleStartImport}
              disabled={!hasGrantedConsent || importDeckMutation.isPending}
              className="glass-interactive flex-1 rounded-lg px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importDeckMutation.isPending ? "Importing..." : "Start Import"}
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

          <div className="glass-child rounded-lg p-8 text-center">
            <div className="border-t-gold-400 mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-white/20"></div>
            <div className="text-lg font-semibold text-white">Importing your deck...</div>
            <div className="mt-2 text-sm text-white/60">This may take a minute</div>
          </div>
        </div>
      )}

      {currentStep === "summary" && importResults && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Step 5: Import Complete!</h2>
          <p className="text-white/80">Your NationStates deck has been successfully imported.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-child rounded-lg p-4">
              <div className="text-sm text-white/60">Cards Imported</div>
              <div className="text-2xl font-bold text-green-400">{importResults.cardsImported}</div>
            </div>
            <div className="glass-child rounded-lg p-4">
              <div className="text-sm text-white/60">Cards Skipped</div>
              <div className="text-2xl font-bold text-white/60">{importResults.cardsSkipped}</div>
            </div>
            <div className="glass-child col-span-2 rounded-lg p-4">
              <div className="text-sm text-white/60">Bonus Credits Earned</div>
              <div className="text-gold-400 text-2xl font-bold">
                {importResults.bonusCredits} IxC
              </div>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="glass-interactive w-full rounded-lg px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
          >
            View My Collection
          </button>
        </div>
      )}
    </div>
  );
}
