"use client";

import React, { memo, useEffect } from "react";
import { CheckCircle, WarningTriangle as AlertTriangle, XmarkCircle as XCircle, Wrench } from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";

interface ValidationStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

export const ValidationStep = memo(function ValidationStep({ importer }: ValidationStepProps) {
  // Auto-run validation when step is entered
  useEffect(() => {
    if (!importer.validationReport) {
      importer.runValidation();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const report = importer.validationReport;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground text-sm font-medium">Topology Validation</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Checking for gaps, overlaps, and geometry issues.
        </p>
      </div>

      {importer.importScope === "cities" ? (
        <div className="flex flex-col gap-2 rounded-lg bg-green-500/10 px-3 py-4 text-xs text-green-700 dark:text-green-400">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4" />
            Ready for City Import
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
            Province topology checks are skipped for cities-only import.{" "}
            {importer.rawCityPoints.length} cities detected in SVG layers.
          </p>
        </div>
      ) : !report ? (
        <div className="bg-accent text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-3 text-xs">
          <div className="border-primary h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
          Running validation...
        </div>
      ) : (
        <>
          {/* Overall status */}
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              report.valid
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            }`}
          >
            {report.valid ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {report.valid ? "Topology is valid" : "Issues detected"}
          </div>

          {/* Coverage */}
          <div className="border-border rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Coverage</span>
              <span className="text-foreground font-mono font-medium">
                {report.coveragePercent}%
              </span>
            </div>
            <div className="bg-accent h-2 w-full rounded-full">
              <div
                className={`h-full rounded-full transition-all ${
                  report.coveragePercent > 95
                    ? "bg-green-500"
                    : report.coveragePercent > 80
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, report.coveragePercent)}%` }}
              />
            </div>
            <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
              <span>Provinces: {report.totalProvincesArea.toLocaleString()} km²</span>
              <span>Country: {report.countryArea.toLocaleString()} km²</span>
            </div>
          </div>

          {/* Gaps */}
          {report.gaps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {report.gaps.length} Gap{report.gaps.length !== 1 ? "s" : ""}
                </span>
                {report.gaps.some((g) => g.autoFixable) && (
                  <button
                    onClick={importer.autoFixGaps}
                    className="text-primary hover:bg-accent flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium"
                  >
                    <Wrench className="h-3 w-3" />
                    Auto-fix small gaps
                  </button>
                )}
              </div>
              {report.gaps.slice(0, 5).map((gap, i) => (
                <div key={i} className="bg-accent rounded px-2 py-1.5 text-[10px]">
                  <span className="font-medium">{gap.areaSqKm} km²</span>
                  {gap.adjacentProvinces.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      — near {gap.adjacentProvinces.join(", ")}
                    </span>
                  )}
                  {gap.autoFixable && <span className="ml-1 text-green-600">(auto-fixable)</span>}
                </div>
              ))}
              {report.gaps.length > 5 && (
                <div className="text-muted-foreground text-[10px]">
                  +{report.gaps.length - 5} more gaps
                </div>
              )}
            </div>
          )}

          {/* Overlaps */}
          {report.overlaps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <XCircle className="h-3.5 w-3.5" />
                  {report.overlaps.length} Overlap{report.overlaps.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={importer.autoFixOverlaps}
                  className="text-primary hover:bg-accent flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium"
                >
                  <Wrench className="h-3 w-3" />
                  Resolve overlaps
                </button>
              </div>
              {report.overlaps.slice(0, 5).map((overlap, i) => (
                <div key={i} className="bg-accent rounded px-2 py-1.5 text-[10px]">
                  <span className="font-medium">{overlap.areaSqKm} km²</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {overlap.provinces[0]} ∩ {overlap.provinces[1]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Feature issues */}
          {report.featureIssues.length > 0 && (
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {report.featureIssues.length} Feature Issue
                {report.featureIssues.length !== 1 ? "s" : ""}
              </span>
              {report.featureIssues.slice(0, 5).map((issue, i) => (
                <div key={i} className="bg-accent rounded px-2 py-1.5 text-[10px]">
                  <span className="font-medium">{issue.provinceName}:</span>{" "}
                  <span className="text-muted-foreground">{issue.issues.join("; ")}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={importer.runValidation}
            className="border-border text-foreground hover:bg-accent w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
          >
            Re-validate
          </button>
        </>
      )}
    </div>
  );
});
