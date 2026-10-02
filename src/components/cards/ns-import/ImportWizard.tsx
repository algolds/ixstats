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

import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import React, { useState } from "react";
import { api } from "~/trpc/react";
import type { NSCard } from "~/lib/nationstates/api-client";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

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
  const notify = useNotify();
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
      notify.error("Please enter a nation name");
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
      notify.error("Failed to request verification. Please try again.");
    }
  };

  const handleCheckVerification = async () => {
    if (!verificationId || !checksum.trim()) {
      notify.error("Please enter your verification code");
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
        notify.error("Verification failed. Please check your code and try again.");
      }
    } catch (error) {
      console.error("Verification check failed:", error);
      notify.error("Verification failed. Please try again.");
    }
  };

  const handleProceedToOptions = () => {
    setCurrentStep("options");
  };

  const handleStartImport = async () => {
    if (!verificationId) {
      notify.error("Verification required");
      return;
    }

    if (!hasGrantedConsent) {
      notify.error(
        "Please confirm your first-party content permission to proceed with the import."
      );
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
      notify.error("Import failed. Please try again.");
      setCurrentStep("options");
    }
  };

  const handleComplete = () => {
    if (importResults) {
      onComplete(importResults);
    }
  };

  return (
    <div className="border-separator bg-surface rounded-row min-h-[600px] border p-8">
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
                      ? "bg-tint"
                      : "bg-fill-2"
                  }`}
                />
              )}
              <div
                className={`text-body flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                  ["auth", "preview", "options", "progress", "summary"].indexOf(currentStep) >= idx
                    ? "bg-tint text-on-tint"
                    : "bg-fill-2 text-label-secondary"
                }`}
              >
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
        <div className="text-footnote text-label-secondary flex justify-between">
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
          <h2 className="text-title-1 text-label">Step 1: Verify Nation Ownership</h2>
          <p className="text-label">
            Enter your NationStates nation name to begin the import process.
          </p>

          <div>
            <label className="text-subhead text-label-secondary mb-2 block">Nation Name</label>
            <Input
              type="text"
              value={nationName}
              onChange={(e) => setNationName(e.target.value)}
              className="w-full"
              placeholder="Enter nation name"
            />
          </div>

          {!verificationId ? (
            <Button
              onClick={handleRequestVerification}
              disabled={requestVerificationMutation.isPending}
              size="lg"
              variant="default"
              className="w-full"
            >
              {requestVerificationMutation.isPending ? "Requesting..." : "Request Verification"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-surface-secondary rounded-row p-4">
                <p className="text-body text-label mb-2">
                  A verification window has been opened. Copy your verification code and paste it
                  below.
                </p>
              </div>

              <div>
                <label className="text-subhead text-label-secondary mb-2 block">
                  Verification Code
                </label>
                <Input
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  className="w-full"
                  placeholder="Paste verification code"
                />
              </div>

              <Button
                onClick={handleCheckVerification}
                disabled={checkVerificationMutation.isPending}
                size="lg"
                variant="default"
                className="w-full"
              >
                {checkVerificationMutation.isPending ? "Verifying..." : "Verify & Continue"}
              </Button>
            </div>
          )}

          <Button onClick={onCancel} size="lg" variant="ghost" className="w-full">
            Cancel
          </Button>
        </div>
      )}

      {currentStep === "preview" && deckData && (
        <div className="space-y-6">
          <h2 className="text-title-1 text-label">Step 2: Deck Preview</h2>
          <p className="text-label">Review your NationStates deck before importing.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-secondary rounded-row p-4">
              <div className="text-body text-label-secondary">Total Cards</div>
              <div className="text-title-1 text-label">{deckData.totalCards}</div>
            </div>
            <div className="bg-surface-secondary rounded-row p-4">
              <div className="text-body text-label-secondary">Unique Cards</div>
              <div className="text-title-1 text-label">{deckData.uniqueCards}</div>
            </div>
            <div className="bg-fill-3 rounded-control col-span-2 p-4">
              <div className="text-body text-label-secondary">Deck Value</div>
              <div className="text-tint text-title-1">{deckData.deckValue.toFixed(2)} Bank</div>
            </div>
          </div>

          <div className="bg-fill-3 rounded-control max-h-96 overflow-y-auto p-4">
            <h3 className="text-headline text-label mb-4">Cards (showing first 20)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {deckData.cards.slice(0, 20).map((card, idx) => (
                <div key={idx} className="bg-surface-secondary rounded-row p-3 text-center">
                  <div className="text-footnote text-label truncate font-semibold">
                    {card.name || `Card ${card.id}`}
                  </div>
                  <div className="text-footnote text-label-secondary mt-1">{card.rarity}</div>
                  {card.quantity && card.quantity > 1 && (
                    <div className="text-tint text-footnote mt-1">x{card.quantity}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setCurrentStep("auth")}
              size="lg"
              variant="ghost"
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handleProceedToOptions} size="lg" variant="default" className="flex-1">
              Continue
            </Button>
          </div>
        </div>
      )}

      {currentStep === "options" && (
        <div className="space-y-6">
          <h2 className="text-title-1 text-label">Step 3: Import Options</h2>
          <p className="text-label">Choose how to handle duplicate cards.</p>

          <div className="space-y-3">
            <label className="bg-fill-3 rounded-control flex cursor-pointer items-start gap-3 p-4 transition-colors">
              <input
                type="radio"
                name="duplicateOption"
                value="skip"
                checked={duplicateOption === "skip"}
                onChange={(e) => setDuplicateOption(e.target.value as "skip" | "merge")}
                className="accent-tint mt-1"
              />
              <div>
                <div className="text-label font-semibold">Skip Duplicates</div>
                <div className="text-body text-label-secondary">
                  Don't import cards you already own. Faster and cleaner.
                </div>
              </div>
            </label>

            <label className="bg-fill-3 rounded-control flex cursor-pointer items-start gap-3 p-4 transition-colors">
              <input
                type="radio"
                name="duplicateOption"
                value="merge"
                checked={duplicateOption === "merge"}
                onChange={(e) => setDuplicateOption(e.target.value as "skip" | "merge")}
                className="accent-tint mt-1"
              />
              <div>
                <div className="text-label font-semibold">Merge Duplicates</div>
                <div className="text-body text-label-secondary">
                  Update existing cards with latest NS data. Recommended for syncing.
                </div>
              </div>
            </label>
          </div>

          <div className="rounded-row bg-tint-fill p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={hasGrantedConsent}
                onChange={(e) => setHasGrantedConsent(e.target.checked)}
                className="accent-tint mt-1 size-4"
              />
              <div className="text-body text-label">
                <span className="text-label font-semibold">
                  First-Party Content Permission & Grant:
                </span>{" "}
                I verify that I am the owner or authorized operator of{" "}
                <strong>{nationName || "this nation"}</strong> on NationStates, and I grant
                permission to display my nation's flag and card representation on IxCards.
              </div>
            </label>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setCurrentStep("preview")}
              size="lg"
              variant="ghost"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleStartImport}
              disabled={!hasGrantedConsent || importDeckMutation.isPending}
              size="lg"
              variant="default"
              className="flex-1"
            >
              {importDeckMutation.isPending ? "Importing..." : "Start Import"}
            </Button>
          </div>
        </div>
      )}

      {currentStep === "progress" && (
        <div className="space-y-6">
          <h2 className="text-title-1 text-label">Step 4: Importing...</h2>
          <p className="text-label">
            Please wait while we import your cards. This may take a few moments.
          </p>

          <div className="bg-surface-secondary rounded-row p-8 text-center">
            <div className="border-t-tint border-separator mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 motion-reduce:animate-none"></div>
            <div className="text-title-3 text-label">Importing your deck...</div>
            <div className="text-body text-label-secondary mt-2">This may take a minute</div>
          </div>
        </div>
      )}

      {currentStep === "summary" && importResults && (
        <div className="space-y-6">
          <h2 className="text-title-1 text-label">Step 5: Import Complete!</h2>
          <p className="text-label">Your NationStates deck has been successfully imported.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-secondary rounded-row p-4">
              <div className="text-body text-label-secondary">Cards Imported</div>
              <div className="text-title-1 text-green">{importResults.cardsImported}</div>
            </div>
            <div className="bg-surface-secondary rounded-row p-4">
              <div className="text-body text-label-secondary">Cards Skipped</div>
              <div className="text-title-1 text-label-secondary">{importResults.cardsSkipped}</div>
            </div>
            <div className="bg-fill-3 rounded-control col-span-2 p-4">
              <div className="text-body text-label-secondary">Bonus Credits Earned</div>
              <div className="text-tint text-title-1 flex items-center gap-1">
                <IxCreditsSymbol className="text-yellow h-6 w-6 shrink-0" />
                {importResults.bonusCredits}
              </div>
            </div>
          </div>

          <Button onClick={handleComplete} size="lg" variant="default" className="w-full">
            View My Collection
          </Button>
        </div>
      )}
    </div>
  );
}
