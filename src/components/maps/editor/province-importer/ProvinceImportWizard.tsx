"use client";

import { Button } from "~/components/ui/button";
import React, { memo, useCallback } from "react";
import {
  Xmark as X,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Upload,
  Label as Tag,
  ArrowSeparate as Move,
  Magnet,
  CheckCircle,
  FloppyDisk as Save,
} from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { UploadStep } from "./UploadStep";
import { NameDetectionStep } from "./NameDetectionStep";
import { AlignmentStep } from "./AlignmentStep";
import { SnapPreviewStep } from "./SnapPreviewStep";
import { ValidationStep } from "./ValidationStep";
import { CommitStep } from "./CommitStep";
import { BorderConformanceModal } from "../BorderConformanceModal";
import type { ImportStep } from "~/lib/maps/province-importer/types";
import { StepIndicator } from "~/components/ui/step-indicator";

interface ProvinceImportWizardProps {
  importer: ReturnType<typeof useProvinceImporter>;
  onClose?: () => void;
  onCancel?: () => void;
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
  onCancel,
  onComplete,
}: ProvinceImportWizardProps) {
  const handleClose = onCancel ?? onClose;

  const handleCommit = useCallback(async () => {
    const result = await importer.commitImport();
    if (result) {
      onComplete?.();
    }
  }, [importer, onComplete]);

  return (
    <div className="bg-surface flex h-full flex-col">
      {/* Header */}
      <div className="border-separator flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-label text-headline">
          {importer.importScope === "cities"
            ? "Import Cities"
            : importer.importScope === "provinces"
              ? "Import Provinces"
              : "Import Provinces & Cities"}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-label-secondary h-6 w-6"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        aria-label="Import steps"
        className="border-separator border-b px-3 py-2"
        steps={STEP_CONFIG.map((s) => ({
          id: s.key,
          label: s.label,
          icon: <s.icon aria-hidden />,
        }))}
        current={importer.stepIndex}
        onStepClick={(index) => {
          const step = STEP_CONFIG[index];
          if (step) importer.goToStep(step.key);
        }}
        compactOnPhones
      />

      {/* Step Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {importer.error && (
          <div className="bg-destructive/10 text-destructive rounded-control text-footnote mb-3 px-3 py-2">
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
      <div className="border-separator flex items-center justify-between border-t px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-label-secondary"
          onClick={importer.goBack}
          disabled={!importer.canGoBack || importer.isProcessing}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Button>

        <div className="text-label-secondary text-footnote">
          {importer.importScope === "cities"
            ? `${importer.alignedCities.length} city/cities aligned`
            : `${importer.includedCount} province${importer.includedCount !== 1 ? "s" : ""} selected`}
        </div>

        {importer.step !== "commit" ? (
          <Button
            size="sm"
            onClick={importer.goNext}
            disabled={
              !importer.canGoNext ||
              importer.isProcessing ||
              (importer.step === "upload" &&
                (importer.importScope === "cities"
                  ? importer.rawCityPoints.length === 0
                  : importer.rawProvinces.length === 0))
            }
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleCommit}
            disabled={
              importer.isProcessing ||
              (importer.importScope === "cities"
                ? importer.alignedCities.length === 0
                : importer.includedCount === 0)
            }
          >
            {importer.isProcessing
              ? "Importing..."
              : importer.importScope === "cities"
                ? "Import Cities"
                : "Import Provinces"}
            <Save className="h-3.5 w-3.5" />
          </Button>
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
