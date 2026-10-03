"use client";

import React, { memo } from "react";
import { WarningTriangle as AlertTriangle, Refresh as Replace } from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { Checkbox } from "~/components/ui/checkbox";

interface CommitStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
  onCommit: () => void;
}

export const CommitStep = memo(function CommitStep({
  importer,
  onCommit: _onCommit,
}: CommitStepProps) {
  const provinces = importer.currentProvinces.filter((p) => p.included);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-label text-body font-medium">Import summary</h3>
        <p className="text-label-secondary text-footnote mt-1">
          Review and confirm the {importer.importScope === "cities" ? "city" : "province"} import.
        </p>
      </div>

      {importer.importScope === "cities" ? (
        <>
          {/* Summary card */}
          <div className="border-separator rounded-control space-y-2 border p-3">
            <div className="text-footnote flex justify-between">
              <span className="text-label-secondary">Cities to import</span>
              <span className="text-label font-medium">{importer.alignedCities.length}</span>
            </div>
            <div className="text-footnote flex justify-between">
              <span className="text-label-secondary">National capitals</span>
              <span className="text-label font-medium">
                {importer.alignedCities.filter((c) => c.isCapital).length}
              </span>
            </div>
          </div>

          {/* City list */}
          <div className="border-separator rounded-control max-h-[200px] overflow-y-auto border">
            {importer.alignedCities.map((c, index) => (
              <div
                key={index}
                className="border-separator flex items-center justify-between border-b px-3 py-2 last:border-0"
              >
                <span className="text-label text-footnote">
                  {c.name || `Unnamed City ${index + 1}`}
                </span>
                {c.isCapital && (
                  <span className="bg-tint-fill text-tint text-caption rounded-control-sm px-2 py-0.5 font-semibold">
                    Capital
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Summary card */}
          <div className="border-separator rounded-control space-y-2 border p-3">
            <div className="text-footnote flex justify-between">
              <span className="text-label-secondary">Provinces to create</span>
              <span className="text-label font-medium">{provinces.length}</span>
            </div>
            {importer.validationReport && (
              <>
                <div className="text-footnote flex justify-between">
                  <span className="text-label-secondary">Coverage</span>
                  <span className="text-label font-medium">
                    {importer.validationReport.coveragePercent}%
                  </span>
                </div>
                <div className="text-footnote flex justify-between">
                  <span className="text-label-secondary">Gaps</span>
                  <span
                    className={`font-medium ${importer.validationReport.gaps.length > 0 ? "text-yellow" : "text-green"}`}
                  >
                    {importer.validationReport.gaps.length}
                  </span>
                </div>
                <div className="text-footnote flex justify-between">
                  <span className="text-label-secondary">Overlaps</span>
                  <span
                    className={`font-medium ${importer.validationReport.overlaps.length > 0 ? "text-red" : "text-green"}`}
                  >
                    {importer.validationReport.overlaps.length}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Province list */}
          <div className="border-separator rounded-control max-h-[200px] overflow-y-auto border">
            {provinces.map((p) => (
              <div
                key={p.sourceId}
                className="border-separator flex items-center gap-2 border-b px-3 py-2 last:border-0"
              >
                {p.color && (
                  <div
                    className="border-separator h-3 w-3 rounded-xs border"
                    style={{ backgroundColor: p.color }}
                  />
                )}
                <span className="text-label text-footnote">{p.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Replace toggle (only if not cities-only) */}
      {importer.importScope !== "cities" && importer.existingSubdivisions.length > 0 && (
        <div className="rounded-control border-yellow/30 bg-yellow/5 border p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <Checkbox
              checked={importer.replaceExisting}
              onCheckedChange={(c) => importer.setReplaceExisting(c === true)}
            />
            <div>
              <span className="text-caption text-yellow flex items-center gap-1">
                <Replace className="h-3 w-3" />
                Replace existing subdivisions
              </span>
              <p className="text-label-secondary text-footnote mt-0.5">
                Delete {importer.existingSubdivisions.length} existing subdivision
                {importer.existingSubdivisions.length !== 1 ? "s" : ""} before importing. This
                cannot be undone.
              </p>
            </div>
          </label>
        </div>
      )}

      {importer.importScope !== "cities" &&
        importer.validationReport &&
        !importer.validationReport.valid && (
          <div className="border-separator rounded-control text-footnote text-yellow flex items-start gap-2 border px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Topology issues were detected. You can still import, but provinces may have gaps or
              overlaps that need manual correction later.
            </span>
          </div>
        )}
    </div>
  );
});
