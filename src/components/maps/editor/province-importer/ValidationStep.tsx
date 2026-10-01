"use client";

import { Button } from "~/components/ui/button";
import React, { memo, useEffect } from "react";
import {
  CheckCircle,
  WarningTriangle as AlertTriangle,
  XmarkCircle as XCircle,
  Wrench,
} from "iconoir-react";
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
    // oxlint-disable-next-line
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const report = importer.validationReport;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-label text-body font-medium">Topology Validation</h3>
        <p className="text-label-secondary text-footnote mt-1">
          Checking for gaps, overlaps, and geometry issues.
        </p>
      </div>

      {importer.importScope === "cities" ? (
        <div className="border-separator rounded-control text-footnote text-green flex flex-col gap-2 border px-3 py-4">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4" />
            Ready for City Import
          </div>
          <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
            Province topology checks are skipped for cities-only import.{" "}
            {importer.rawCityPoints.length} cities detected in SVG layers.
          </p>
        </div>
      ) : !report ? (
        <div className="bg-fill-3 text-label-secondary rounded-control text-footnote flex items-center gap-2 px-3 py-3">
          <div className="border-tint h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
          Running validation...
        </div>
      ) : (
        <>
          {/* Overall status */}
          <div
            className={`rounded-control text-caption flex items-center gap-2 px-3 py-2 ${
              report.valid
                ? "border-green/30 text-green border"
                : "border-yellow/30 text-yellow border"
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
          <div className="border-separator rounded-control border p-3">
            <div className="text-footnote mb-2 flex items-center justify-between">
              <span className="text-label-secondary">Coverage</span>
              <span className="text-label font-medium tabular-nums">{report.coveragePercent}%</span>
            </div>
            <div className="bg-fill-3 h-2 w-full rounded-full">
              <div
                className={`h-full rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                  report.coveragePercent > 95
                    ? "bg-green"
                    : report.coveragePercent > 80
                      ? "bg-yellow"
                      : "bg-red"
                }`}
                style={{ width: `${Math.min(100, report.coveragePercent)}%` }}
              />
            </div>
            <div className="text-label-secondary text-footnote mt-1 flex justify-between">
              <span>Provinces: {report.totalProvincesArea.toLocaleString()} km²</span>
              <span>Country: {report.countryArea.toLocaleString()} km²</span>
            </div>
          </div>

          {/* Gaps */}
          {report.gaps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption text-yellow flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {report.gaps.length} Gap{report.gaps.length !== 1 ? "s" : ""}
                </span>
                {report.gaps.some((g) => g.autoFixable) && (
                  <Button variant="ghost" size="xs" onClick={importer.autoFixGaps}>
                    <Wrench className="h-3 w-3" />
                    Auto-fix small gaps
                  </Button>
                )}
              </div>
              {report.gaps.slice(0, 5).map((gap, i) => (
                <div key={i} className="bg-fill-3 text-footnote rounded-control-sm px-2 py-2">
                  <span className="font-medium">{gap.areaSqKm} km²</span>
                  {gap.adjacentProvinces.length > 0 && (
                    <span className="text-label-secondary">
                      {" "}
                      — near {gap.adjacentProvinces.join(", ")}
                    </span>
                  )}
                  {gap.autoFixable && <span className="text-green ml-1">(auto-fixable)</span>}
                </div>
              ))}
              {report.gaps.length > 5 && (
                <div className="text-label-secondary text-footnote">
                  +{report.gaps.length - 5} more gaps
                </div>
              )}
            </div>
          )}

          {/* Overlaps */}
          {report.overlaps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption text-red flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5" />
                  {report.overlaps.length} Overlap{report.overlaps.length !== 1 ? "s" : ""}
                </span>
                <Button variant="ghost" size="xs" onClick={importer.autoFixOverlaps}>
                  <Wrench className="h-3 w-3" />
                  Resolve overlaps
                </Button>
              </div>
              {report.overlaps.slice(0, 5).map((overlap, i) => (
                <div key={i} className="bg-fill-3 text-footnote rounded-control-sm px-2 py-2">
                  <span className="font-medium">{overlap.areaSqKm} km²</span>
                  <span className="text-label-secondary">
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
              <span className="text-caption text-yellow flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                {report.featureIssues.length} Feature Issue
                {report.featureIssues.length !== 1 ? "s" : ""}
              </span>
              {report.featureIssues.slice(0, 5).map((issue, i) => (
                <div key={i} className="bg-fill-3 text-footnote rounded-control-sm px-2 py-2">
                  <span className="font-medium">{issue.provinceName}:</span>{" "}
                  <span className="text-label-secondary">{issue.issues.join("; ")}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full" onClick={importer.runValidation}>
            Re-validate
          </Button>
        </>
      )}
    </div>
  );
});
