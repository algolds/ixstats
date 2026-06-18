"use client";

import React, { memo } from "react";
import { Check } from "lucide-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";

interface NameDetectionStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

export const NameDetectionStep = memo(function NameDetectionStep({
  importer,
}: NameDetectionStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-foreground text-sm font-medium">
          Detected Provinces ({importer.rawProvinces.length})
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Review auto-detected province names. Edit names, or exclude provinces you don&apos;t want
          to import.
        </p>
      </div>

      <div className="border-border max-h-[400px] overflow-y-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-card sticky top-0">
            <tr className="border-border border-b">
              <th className="text-muted-foreground px-2 py-1.5 text-left font-medium">Include</th>
              <th className="text-muted-foreground px-2 py-1.5 text-left font-medium">Color</th>
              <th className="text-muted-foreground px-2 py-1.5 text-left font-medium">Name</th>
              <th className="text-muted-foreground px-2 py-1.5 text-right font-medium">
                Confidence
              </th>
            </tr>
          </thead>
          <tbody>
            {importer.rawProvinces.map((province) => (
              <tr
                key={province.sourceId}
                className={`border-border/50 border-b ${!province.included ? "opacity-40" : ""}`}
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
                      className="border-border h-4 w-4 rounded border"
                      style={{ backgroundColor: province.color }}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={province.name}
                    onChange={(e) => importer.updateProvinceName(province.sourceId, e.target.value)}
                    className="text-foreground focus:border-primary focus:bg-accent w-full rounded border border-transparent bg-transparent px-1 py-0.5 transition-colors outline-none"
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

      <div className="text-muted-foreground flex items-center justify-between text-[10px]">
        <span>
          {importer.includedCount} of {importer.rawProvinces.length} provinces selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={() =>
              importer.rawProvinces.forEach((p) => {
                if (!p.included) importer.toggleProvinceIncluded(p.sourceId);
              })
            }
            className="text-primary hover:underline"
          >
            Select all
          </button>
          <button
            onClick={() =>
              importer.rawProvinces.forEach((p) => {
                if (p.included) importer.toggleProvinceIncluded(p.sourceId);
              })
            }
            className="text-primary hover:underline"
          >
            Deselect all
          </button>
        </div>
      </div>

      {importer.hasCities && (
        <div className="border-border bg-card/40 mt-3 space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-foreground text-xs font-semibold">Import Cities</span>
              <p className="text-muted-foreground text-[10px]">
                Import city point markers detected in this SVG.
              </p>
            </div>
            <button
              onClick={() => importer.setImportCities(!importer.importCities)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                importer.importCities
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {importer.importCities ? "Enabled" : "Disabled"}
            </button>
          </div>

          {importer.importCities && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Cities Layer
                  </label>
                  <select
                    value={importer.citiesLayerId}
                    onChange={(e) =>
                      importer.setLayer(
                        e.target.value,
                        importer.capitalLayerId,
                        importer.cityNameLayerId
                      )
                    }
                    className="border-border bg-background text-foreground focus:border-primary w-full rounded border px-2 py-1 outline-none"
                  >
                    <option value="">-- Auto-detect --</option>
                    {importer.cityLayers.map((layer) => (
                      <option key={layer.id} value={layer.id}>
                        {layer.name} ({layer.markerCount} points)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Capitals Layer (Optional)
                  </label>
                  <select
                    value={importer.capitalLayerId}
                    onChange={(e) =>
                      importer.setLayer(
                        importer.citiesLayerId,
                        e.target.value,
                        importer.cityNameLayerId
                      )
                    }
                    className="border-border bg-background text-foreground focus:border-primary w-full rounded border px-2 py-1 outline-none"
                  >
                    <option value="">-- None --</option>
                    {importer.cityLayers.map((layer) => (
                      <option key={layer.id} value={layer.id}>
                        {layer.name} ({layer.markerCount} points)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    City Names (Optional)
                  </label>
                  <select
                    value={importer.cityNameLayerId}
                    onChange={(e) =>
                      importer.setLayer(
                        importer.citiesLayerId,
                        importer.capitalLayerId,
                        e.target.value
                      )
                    }
                    className="border-border bg-background text-foreground focus:border-primary w-full rounded border px-2 py-1 outline-none"
                  >
                    <option value="">-- None (Auto) --</option>
                    {importer.cityLayers.map((layer) => (
                      <option key={layer.id} value={layer.id}>
                        {layer.name} ({layer.textCount} label{layer.textCount !== 1 ? "s" : ""})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {importer.snappedCitiesCount > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
                  <strong>Notice:</strong> {importer.snappedCitiesCount} city dot
                  {importer.snappedCitiesCount !== 1 ? "s" : ""} detected slightly outside country
                  boundaries and will be automatically snapped to the border.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
