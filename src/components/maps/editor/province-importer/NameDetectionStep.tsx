"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { memo } from "react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

interface NameDetectionStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

const SELECTION_ACTIONS = [
  { label: "Select all", target: true },
  { label: "Deselect all", target: false },
];

type CityLayer = ReturnType<typeof useProvinceImporter>["cityLayers"][number];
const markerCountLabel = (layer: CityLayer) => `${layer.name} (${layer.markerCount} points)`;

export const NameDetectionStep = memo(function NameDetectionStep({
  importer,
}: NameDetectionStepProps) {
  const { citiesLayerId, capitalLayerId, cityNameLayerId, setLayer } = importer;
  const cityLayerSelects = [
    {
      title: "Cities layer",
      ariaLabel: "Cities layer",
      emptyLabel: "-- Auto-detect --",
      value: citiesLayerId,
      onChange: (v: string) => setLayer(v, capitalLayerId, cityNameLayerId),
      optionLabel: markerCountLabel,
    },
    {
      title: "Capitals Layer (Optional)",
      ariaLabel: "Capitals layer",
      emptyLabel: "-- None --",
      value: capitalLayerId,
      onChange: (v: string) => setLayer(citiesLayerId, v, cityNameLayerId),
      optionLabel: markerCountLabel,
    },
    {
      title: "City Names (Optional)",
      ariaLabel: "City name layer",
      emptyLabel: "-- None (Auto) --",
      value: cityNameLayerId,
      onChange: (v: string) => setLayer(citiesLayerId, capitalLayerId, v),
      optionLabel: (layer: CityLayer) =>
        `${layer.name} (${layer.textCount} label${layer.textCount !== 1 ? "s" : ""})`,
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-label text-body font-medium">
          Detected Provinces ({importer.rawProvinces.length})
        </h3>
        <p className="text-label-secondary text-footnote mt-1">
          Review auto-detected province names. Edit names, or exclude provinces you don&apos;t want
          to import.
        </p>
      </div>

      <Table containerClassName="max-h-[400px]" className="text-footnote">
        <TableHeader sticky>
          <TableRow>
            <TableHead>Include</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {importer.rawProvinces.map((province) => (
            <TableRow
              key={province.sourceId}
              className={!province.included ? "opacity-40" : undefined}
            >
              <TableCell>
                <Checkbox
                  aria-label={`Include ${province.name || province.sourceId}`}
                  checked={province.included}
                  onCheckedChange={() => importer.toggleProvinceIncluded(province.sourceId)}
                />
              </TableCell>
              <TableCell>
                {province.color && (
                  <div
                    aria-hidden
                    className="border-separator size-4 rounded-xs border"
                    style={{ backgroundColor: province.color }}
                  />
                )}
              </TableCell>
              <TableCell>
                <input
                  type="text"
                  aria-label="Province name"
                  value={province.name}
                  onChange={(e) => importer.updateProvinceName(province.sourceId, e.target.value)}
                  className="text-label focus:border-tint focus:bg-fill-3 rounded-control-sm w-full border border-transparent bg-transparent px-1 py-0.5 transition-colors outline-none"
                />
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    province.confidence >= 0.8
                      ? "success"
                      : province.confidence >= 0.5
                        ? "warning"
                        : "destructive"
                  }
                  className="tabular-nums"
                >
                  {Math.round(province.confidence * 100)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="text-label-secondary text-footnote flex items-center justify-between">
        <span>
          {importer.includedCount} of {importer.rawProvinces.length} provinces selected
        </span>
        <div className="flex gap-2">
          {SELECTION_ACTIONS.map(({ label, target }) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              onClick={() =>
                importer.rawProvinces.forEach((p) => {
                  if (p.included !== target) importer.toggleProvinceIncluded(p.sourceId);
                })
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {importer.hasCities && (
        <Card className="mt-3 space-y-3 p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-label text-caption font-semibold">Import cities</span>
              <p className="text-label-secondary text-footnote">
                Import city point markers detected in this SVG.
              </p>
            </div>
            <Switch
              aria-label="Import cities"
              checked={importer.importCities}
              onCheckedChange={(checked) => importer.setImportCities(checked)}
            />
          </div>

          {importer.importCities && (
            <div className="space-y-2">
              <div className="text-footnote grid grid-cols-3 gap-2">
                {cityLayerSelects.map((select) => (
                  <div key={select.ariaLabel} className="space-y-1">
                    <Eyebrow className="block">{select.title}</Eyebrow>
                    <OptionSelect
                      aria-label={select.ariaLabel}
                      size="sm"
                      value={select.value}
                      onValueChange={select.onChange}
                      options={[
                        { value: "", label: select.emptyLabel },
                        ...importer.cityLayers.map((layer) => ({
                          value: layer.id,
                          label: select.optionLabel(layer),
                        })),
                      ]}
                    />
                  </div>
                ))}
              </div>

              {importer.snappedCitiesCount > 0 && (
                <div className="border-separator rounded-control text-footnote text-yellow border px-3 py-2 leading-relaxed">
                  <strong>Notice:</strong> {importer.snappedCitiesCount} city dot
                  {importer.snappedCitiesCount !== 1 ? "s" : ""} detected slightly outside country
                  boundaries and will be automatically snapped to the border.
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
});
