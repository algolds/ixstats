"use client";

import React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { useCityImporter } from "~/hooks/useCityImporter";

interface PreviewStepProps {
  importer: ReturnType<typeof useCityImporter>;
}

export function PreviewStep({ importer }: PreviewStepProps) {
  const { parsed, validated, isProcessing, error } = importer;

  if (!parsed) return null;

  // Use validated rows if available, else parsed rows with their parse errors as issues
  const displayRows =
    validated ??
    parsed.rows.map((r) => ({
      ...r,
      issues: r._parseErrors ?? [],
    }));

  const totalCount = displayRows.length;
  const errorCount = displayRows.filter(
    (r) =>
      r.issues.length > 0 &&
      r.issues.some(
        (i) =>
          i.includes("missing required field") ||
          i.includes("out of range") ||
          i.includes("invalid lat") ||
          i.includes("invalid lng") ||
          i.includes("outside country")
      )
  ).length;
  const warningCount = displayRows.filter(
    (r) =>
      r.issues.length > 0 &&
      !r.issues.some(
        (i) =>
          i.includes("missing required field") ||
          i.includes("out of range") ||
          i.includes("invalid lat") ||
          i.includes("invalid lng") ||
          i.includes("outside country")
      )
  ).length;
  const validCount = totalCount - errorCount;

  return (
    <div className="flex flex-col gap-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">
          <span className="text-foreground font-semibold">{totalCount}</span> rows
        </span>
        <span className="text-emerald-500">
          <span className="font-semibold">{validCount}</span> valid
        </span>
        {errorCount > 0 && (
          <span className="text-destructive">
            <span className="font-semibold">{errorCount}</span> errors
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-amber-500">
            <span className="font-semibold">{warningCount}</span> warnings
          </span>
        )}
        <button
          onClick={() => void importer.validate()}
          disabled={isProcessing}
          className="bg-primary text-primary-foreground ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-opacity disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Validating…
            </>
          ) : (
            "Validate"
          )}
        </button>
      </div>

      {/* Parse-level warnings */}
      {parsed.warnings.length > 0 && (
        <div className="space-y-1">
          {parsed.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Global errors */}
      {parsed.errors.length > 0 && (
        <div className="space-y-1">
          {parsed.errors.map((e, i) => (
            <div
              key={i}
              className="bg-destructive/10 text-destructive flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
            >
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      {/* Server error */}
      {error && (
        <div className="bg-destructive/10 text-destructive border-destructive/20 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Row list */}
      <div className="border-border bg-background max-h-64 space-y-1 overflow-y-auto rounded-lg border">
        {displayRows.map((row, idx) => {
          const hasBlockingError = row.issues.some(
            (i) =>
              i.includes("missing required field") ||
              i.includes("out of range") ||
              i.includes("invalid lat") ||
              i.includes("invalid lng") ||
              i.includes("outside country")
          );
          const hasWarning = !hasBlockingError && row.issues.length > 0;

          return (
            <div
              key={idx}
              className={`border-border flex flex-col gap-1 border-b px-3 py-2 text-xs last:border-b-0 ${
                hasBlockingError ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {hasBlockingError ? (
                  <AlertCircle className="text-destructive h-3 w-3 shrink-0" />
                ) : hasWarning ? (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                )}
                <span className="text-foreground truncate font-medium">
                  {row.name || <span className="text-muted-foreground italic">unnamed</span>}
                </span>
                <span className="text-muted-foreground ml-auto shrink-0">
                  {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                </span>
                {row.cityType && (
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                    {row.cityType}
                  </span>
                )}
                {row.population !== undefined && (
                  <span className="text-muted-foreground text-[10px]">
                    pop. {row.population.toLocaleString()}
                  </span>
                )}
              </div>
              {row.issues.length > 0 && (
                <div className="space-y-0.5 pl-5">
                  {row.issues.map((issue, ii) => (
                    <p
                      key={ii}
                      className={`text-[10px] ${
                        hasBlockingError ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {issue}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
