"use client";

import React from "react";
import { X, Upload, List, CheckCircle2, Loader2 } from "lucide-react";
import { useCityImporter } from "~/hooks/useCityImporter";
import { UploadStep } from "./UploadStep";
import { PreviewStep } from "./PreviewStep";
import type { CityImportStep } from "~/hooks/useCityImporter";

interface CityImportWizardProps {
  countryId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const STEP_CONFIG: { key: CityImportStep; label: string; icon: typeof Upload }[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "preview", label: "Preview", icon: List },
  { key: "commit", label: "Done", icon: CheckCircle2 },
];

export function CityImportWizard({ countryId, onComplete, onCancel }: CityImportWizardProps) {
  const importer = useCityImporter(countryId);

  const currentStepIdx = STEP_CONFIG.findIndex((s) => s.key === importer.step);

  const handleBack = () => {
    if (importer.step === "preview") {
      importer.setStep("upload");
    } else if (importer.step === "commit") {
      importer.reset();
    }
  };

  const handleNext = async () => {
    if (importer.step === "preview") {
      await importer.commitImport();
    } else if (importer.step === "commit") {
      onComplete?.();
    }
  };

  const canGoBack = importer.step !== "upload";
  const canGoNext = importer.step === "preview" ? importer.canCommit : importer.step === "commit";

  return (
    <div className="bg-card flex h-full flex-col">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-foreground text-sm font-semibold">Import Cities</h2>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="border-border flex items-center gap-2 border-b px-4 py-2">
        {STEP_CONFIG.map((s, idx) => {
          const StepIcon = s.icon;
          const isActive = s.key === importer.step;
          const isPast = idx < currentStepIdx;
          return (
            <React.Fragment key={s.key}>
              {idx > 0 && (
                <div
                  className={`h-px flex-1 ${
                    isPast ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  isActive
                    ? "text-primary"
                    : isPast
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                <StepIcon className="h-3.5 w-3.5" />
                <span>{s.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {importer.step === "upload" && <UploadStep importer={importer} />}
        {importer.step === "preview" && <PreviewStep importer={importer} />}
        {importer.step === "commit" && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-foreground text-sm font-semibold">Import Complete</p>
            <p className="text-muted-foreground text-xs">
              {importer.committedCount} {importer.committedCount === 1 ? "city" : "cities"} added
              to your map.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {importer.step !== "upload" && (
        <div className="border-border flex items-center justify-between border-t px-4 py-3">
          <button
            onClick={handleBack}
            disabled={importer.isProcessing}
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
          >
            {importer.step === "commit" ? "Import More" : "Back"}
          </button>
          <button
            onClick={() => void handleNext()}
            disabled={!canGoNext || importer.isProcessing}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {importer.isProcessing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Importing…
              </>
            ) : importer.step === "commit" ? (
              "Close"
            ) : (
              "Import"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
