"use client";

import React, { memo, useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle, Wrench } from "lucide-react";
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
        <h3 className="text-sm font-medium text-foreground">Topology Validation</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Checking for gaps, overlaps, and geometry issues.
        </p>
      </div>

      {!report ? (
        <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-3 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Coverage</span>
              <span className="font-mono font-medium text-foreground">{report.coveragePercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-accent">
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
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
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
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-accent"
                  >
                    <Wrench className="h-3 w-3" />
                    Auto-fix small gaps
                  </button>
                )}
              </div>
              {report.gaps.slice(0, 5).map((gap, i) => (
                <div key={i} className="rounded bg-accent px-2 py-1.5 text-[10px]">
                  <span className="font-medium">{gap.areaSqKm} km²</span>
                  {gap.adjacentProvinces.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}— near {gap.adjacentProvinces.join(", ")}
                    </span>
                  )}
                  {gap.autoFixable && (
                    <span className="ml-1 text-green-600">(auto-fixable)</span>
                  )}
                </div>
              ))}
              {report.gaps.length > 5 && (
                <div className="text-[10px] text-muted-foreground">
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
                  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-accent"
                >
                  <Wrench className="h-3 w-3" />
                  Resolve overlaps
                </button>
              </div>
              {report.overlaps.slice(0, 5).map((overlap, i) => (
                <div key={i} className="rounded bg-accent px-2 py-1.5 text-[10px]">
                  <span className="font-medium">{overlap.areaSqKm} km²</span>
                  <span className="text-muted-foreground">
                    {" "}— {overlap.provinces[0]} ∩ {overlap.provinces[1]}
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
                {report.featureIssues.length} Feature Issue{report.featureIssues.length !== 1 ? "s" : ""}
              </span>
              {report.featureIssues.slice(0, 5).map((issue, i) => (
                <div key={i} className="rounded bg-accent px-2 py-1.5 text-[10px]">
                  <span className="font-medium">{issue.provinceName}:</span>{" "}
                  <span className="text-muted-foreground">{issue.issues.join("; ")}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={importer.runValidation}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Re-validate
          </button>
        </>
      )}
    </div>
  );
});
