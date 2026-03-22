"use client";

import React, { memo, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Upload, Tag, Move, Magnet, CheckCircle, Save } from "lucide-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { UploadStep } from "./UploadStep";
import { NameDetectionStep } from "./NameDetectionStep";
import { AlignmentStep } from "./AlignmentStep";
import { SnapPreviewStep } from "./SnapPreviewStep";
import { ValidationStep } from "./ValidationStep";
import { CommitStep } from "./CommitStep";
import { BorderConformanceModal } from "../BorderConformanceModal";
import type { ImportStep } from "~/lib/province-importer/types";

interface ProvinceImportWizardProps {
  importer: ReturnType<typeof useProvinceImporter>;
  onClose: () => void;
  onComplete?: () => void;
}

const STEP_CONFIG: { key: ImportStep; label: string; icon: typeof Upload }[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "names", label: "Names", icon: Tag },
  { key: "align", label: "Align", icon: Move },
  { key: "snap", label: "Snap", icon: Magnet },
  { key: "validate", label: "Validate", icon: CheckCircle },
  { key: "commit", label: "Commit", icon: Save },
];

export const ProvinceImportWizard = memo(function ProvinceImportWizard({
  importer,
  onClose,
  onComplete,
}: ProvinceImportWizardProps) {

  const handleCommit = useCallback(async () => {
    const result = await importer.commitImport();
    if (result) {
      onComplete?.();
    }
  }, [importer, onComplete]);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Import Provinces</h2>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0.5 border-b border-border px-3 py-2">
        {STEP_CONFIG.map((s, i) => {
          const Icon = s.icon;
          const isActive = importer.step === s.key;
          const isPast = importer.stepIndex > i;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={`h-px w-3 ${isPast ? "bg-primary" : "bg-border"}`} />
              )}
              <button
                onClick={() => isPast && importer.goToStep(s.key)}
                disabled={!isPast}
                className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : isPast
                      ? "cursor-pointer text-primary/70 hover:bg-accent"
                      : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {importer.error && (
          <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {importer.error}
          </div>
        )}

        {importer.step === "upload" && <UploadStep importer={importer} />}
        {importer.step === "names" && <NameDetectionStep importer={importer} />}
        {importer.step === "align" && <AlignmentStep importer={importer} />}
        {importer.step === "snap" && <SnapPreviewStep importer={importer} />}
        {importer.step === "validate" && <ValidationStep importer={importer} />}
        {importer.step === "commit" && <CommitStep importer={importer} onCommit={handleCommit} />}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <button
          onClick={importer.goBack}
          disabled={!importer.canGoBack || importer.isProcessing}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="text-[10px] text-muted-foreground">
          {importer.includedCount} province{importer.includedCount !== 1 ? "s" : ""} selected
        </div>

        {importer.step !== "commit" ? (
          <button
            onClick={importer.goNext}
            disabled={!importer.canGoNext || importer.isProcessing || (importer.step === "upload" && importer.rawProvinces.length === 0)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleCommit}
            disabled={importer.isProcessing || importer.includedCount === 0}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {importer.isProcessing ? "Importing..." : "Import Provinces"}
            <Save className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {/* Border conformance warning modal */}
      <BorderConformanceModal
        open={importer.showConformanceModal}
        onClose={() => importer.setShowConformanceModal(false)}
        clippedNames={importer.conformanceResult?.clippedNames ?? []}
        onAccept={() => importer.setShowConformanceModal(false)}
      />
    </div>
  );
});
