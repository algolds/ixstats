"use client";

import React, { memo } from "react";
import { Check } from "lucide-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";

interface NameDetectionStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

export const NameDetectionStep = memo(function NameDetectionStep({ importer }: NameDetectionStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          Detected Provinces ({importer.rawProvinces.length})
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Review auto-detected province names. Edit names, or exclude provinces you don&apos;t want to import.
        </p>
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Include</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Color</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {importer.rawProvinces.map((province) => (
              <tr
                key={province.sourceId}
                className={`border-b border-border/50 ${!province.included ? "opacity-40" : ""}`}
              >
                <td className="px-2 py-1.5">
                  <button
                    onClick={() => importer.toggleProvinceIncluded(province.sourceId)}
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      province.included
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {province.included && <Check className="h-3 w-3" />}
                  </button>
                </td>
                <td className="px-2 py-1.5">
                  {province.color && (
                    <div
                      className="h-4 w-4 rounded border border-border"
                      style={{ backgroundColor: province.color }}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={province.name}
                    onChange={(e) => importer.updateProvinceName(province.sourceId, e.target.value)}
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-foreground outline-none transition-colors focus:border-primary focus:bg-accent"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      province.confidence >= 0.8
                        ? "bg-green-500/10 text-green-600"
                        : province.confidence >= 0.5
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-red-500/10 text-red-600"
                    }`}
                  >
                    {Math.round(province.confidence * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{importer.includedCount} of {importer.rawProvinces.length} provinces selected</span>
        <div className="flex gap-2">
          <button
            onClick={() => importer.rawProvinces.forEach((p) => {
              if (!p.included) importer.toggleProvinceIncluded(p.sourceId);
            })}
            className="text-primary hover:underline"
          >
            Select all
          </button>
          <button
            onClick={() => importer.rawProvinces.forEach((p) => {
              if (p.included) importer.toggleProvinceIncluded(p.sourceId);
            })}
            className="text-primary hover:underline"
          >
            Deselect all
          </button>
        </div>
      </div>
    </div>
  );
});
