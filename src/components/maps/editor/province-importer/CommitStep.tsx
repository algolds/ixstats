"use client";

import React, { memo } from "react";
import { WarningTriangle as AlertTriangle, Refresh as Replace } from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";

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
        <h3 className="text-foreground text-sm font-medium">Import Summary</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Review and confirm the {importer.importScope === "cities" ? "city" : "province"} import.
        </p>
      </div>

      {importer.importScope === "cities" ? (
        <>
          {/* Summary card */}
          <div className="border-border space-y-2 rounded-lg border p-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cities to import</span>
              <span className="text-foreground font-medium">{importer.alignedCities.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">National capitals</span>
              <span className="text-foreground font-medium">
                {importer.alignedCities.filter((c) => c.isCapital).length}
              </span>
            </div>
          </div>

          {/* City list */}
          <div className="border-border max-h-[200px] overflow-y-auto rounded-lg border">
            {importer.alignedCities.map((c, index) => (
              <div
                key={index}
                className="border-border/50 flex items-center justify-between border-b px-3 py-1.5 last:border-0"
              >
                <span className="text-foreground text-xs">
                  {c.name || `Unnamed City ${index + 1}`}
                </span>
                {c.isCapital && (
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold">
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
          <div className="border-border space-y-2 rounded-lg border p-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Provinces to create</span>
              <span className="text-foreground font-medium">{provinces.length}</span>
            </div>
            {importer.validationReport && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="text-foreground font-medium">
                    {importer.validationReport.coveragePercent}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Gaps</span>
                  <span
                    className={`font-medium ${importer.validationReport.gaps.length > 0 ? "text-amber-600" : "text-green-600"}`}
                  >
                    {importer.validationReport.gaps.length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Overlaps</span>
                  <span
                    className={`font-medium ${importer.validationReport.overlaps.length > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {importer.validationReport.overlaps.length}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Province list */}
          <div className="border-border max-h-[200px] overflow-y-auto rounded-lg border">
            {provinces.map((p) => (
              <div
                key={p.sourceId}
                className="border-border/50 flex items-center gap-2 border-b px-3 py-1.5 last:border-0"
              >
                {p.color && (
                  <div
                    className="border-border h-3 w-3 rounded border"
                    style={{ backgroundColor: p.color }}
                  />
                )}
                <span className="text-foreground text-xs">{p.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Replace toggle (only if not cities-only) */}
      {importer.importScope !== "cities" && importer.existingSubdivisions.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={importer.replaceExisting}
              onChange={(e) => importer.setReplaceExisting(e.target.checked)}
              className="border-border mt-0.5 rounded"
            />
            <div>
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Replace className="h-3 w-3" />
                Replace existing subdivisions
              </span>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
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
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
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
