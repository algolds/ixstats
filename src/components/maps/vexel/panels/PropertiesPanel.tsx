"use client";

import { Check } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import {
  TINCTURE_HEX,
  DIVISIONS,
  ORDINARIES,
  LINE_STYLES,
  SHIELD_SHAPES,
  ATTITUDES,
  HELM_TYPES,
  DIVISION_SECTIONS_COUNT,
} from "~/lib/heraldry";
import type {
  Tincture,
  Division,
  OrdinaryType,
  LineStyle,
  ShieldShape,
  Attitude,
  HelmType,
} from "~/lib/heraldry";
import { Card } from "~/components/ui/card";

export default function PropertiesPanel() {
  const {
    composition,
    selectedLayerPath,
    updateField,
    updateOrdinary,
    updateCharge,
    updateComposition,
    updateExternals,
  } = useVexelEditor();

  const parseIndices = (path: string) => {
    const match = path.match(/\[(\d+)\]/);
    return match ? parseInt(match[1]!, 10) : null;
  };

  const getTinctureLabel = (tinc: string) => {
    return tinc.charAt(0).toUpperCase() + tinc.slice(1);
  };

  // Color picker component
  // oxlint-disable-next-line
  const TincturePicker = ({
    value,
    onChange,
  }: {
    value: Tincture;
    onChange: (t: Tincture) => void;
  }) => (
    <div
      role="radiogroup"
      aria-label="Tincture"
      className="bg-surface-secondary rounded-control mt-1 grid grid-cols-4 gap-2 p-2"
    >
      {Object.keys(TINCTURE_HEX).map((t) => {
        const key = t as Tincture;
        const color = TINCTURE_HEX[key];
        const isSelected = value === key;

        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={getTinctureLabel(key)}
            title={getTinctureLabel(key)}
            onClick={() => onChange(key)}
            className={`rounded-control-sm focus-visible:outline-tint relative h-7 w-full border transition-[border-color,box-shadow,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isSelected
                ? "border-tint ring-tint ring-2"
                : "border-separator opacity-70 hover:opacity-100"
            }`}
            style={{ backgroundColor: color }}
          >
            {isSelected && (
              <span className="bg-fill-3 text-label rounded-control-sm absolute inset-0 flex items-center justify-center">
                <Check className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  // Render properties based on active selection
  if (!selectedLayerPath) {
    return (
      <Card className="h-full overflow-hidden">
        <div className="text-label-secondary text-footnote flex h-full items-center justify-center p-6 text-center italic">
          Select a layer from the tree to edit properties
        </div>
      </Card>
    );
  }

  // 1. Root Shield properties
  if (selectedLayerPath === "shield") {
    return (
      <Card className="overflow-hidden">
        <div className="text-footnote flex flex-col gap-4 p-4">
          <Eyebrow className="border-separator block border-b pb-2">Shield properties</Eyebrow>

          <div className="space-y-1">
            <label className="text-label-secondary font-medium">Shape</label>
            <OptionSelect
              aria-label="Shape"
              value={composition.shield.shape}
              onValueChange={(v) =>
                updateComposition({
                  ...composition,
                  shield: { ...composition.shield, shape: v as ShieldShape },
                })
              }
              options={SHIELD_SHAPES}
            />
          </div>
        </div>
      </Card>
    );
  }

  // 2. Field properties
  if (selectedLayerPath === "shield.field") {
    const field = composition.shield.field;
    const expectedCount = DIVISION_SECTIONS_COUNT[field.division] ?? 1;

    const handleDivisionChange = (div: Division) => {
      const nextCount = DIVISION_SECTIONS_COUNT[div] ?? 1;
      const nextTinctures = [...field.tinctures];

      // Pad or slice tinctures to match expectedCount
      while (nextTinctures.length < nextCount) {
        nextTinctures.push("argent");
      }
      const finalTinctures = nextTinctures.slice(0, nextCount);

      updateField({
        ...field,
        division: div,
        tinctures: finalTinctures,
      });
    };

    const handleTinctureChange = (tincIdx: number, tinc: Tincture) => {
      const nextTinctures = [...field.tinctures];
      nextTinctures[tincIdx] = tinc;
      updateField({
        ...field,
        tinctures: nextTinctures,
      });
    };

    return (
      <Card className="overflow-hidden">
        <div className="text-footnote flex max-h-[400px] flex-col gap-4 overflow-y-auto p-4">
          <Eyebrow className="border-separator block border-b pb-2">Field properties</Eyebrow>

          <div className="space-y-1">
            <label className="text-label-secondary font-medium">Division</label>
            <OptionSelect
              aria-label="Division"
              value={field.division}
              onValueChange={(v) => handleDivisionChange(v as Division)}
              options={DIVISIONS}
            />
          </div>

          <div className="space-y-1">
            <label className="text-label-secondary font-medium">Line style</label>
            <OptionSelect
              aria-label="Line style"
              value={field.lineStyle}
              onValueChange={(v) => updateField({ ...field, lineStyle: v as LineStyle })}
              options={LINE_STYLES}
            />
          </div>

          {/* Tincture pickers for divisions */}
          <div className="border-separator space-y-3 border-t pt-2">
            <span className="text-label-secondary block font-semibold">
              Tinctures ({expectedCount})
            </span>
            {Array.from({ length: expectedCount }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Eyebrow>Section {i + 1}</Eyebrow>
                <TincturePicker
                  value={field.tinctures[i] ?? "argent"}
                  onChange={(tinc) => handleTinctureChange(i, tinc)}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // 3. Ordinary properties
  if (selectedLayerPath.startsWith("shield.ordinaries")) {
    const idx = parseIndices(selectedLayerPath);
    if (idx === null) return null;

    const ord = composition.shield.ordinaries?.[idx];
    if (!ord) return null;

    return (
      <Card className="overflow-hidden">
        <div className="text-footnote flex flex-col gap-4 p-4">
          <Eyebrow className="border-separator block border-b pb-2">
            Ordinary properties ({idx + 1})
          </Eyebrow>

          <div className="space-y-1">
            <label className="text-label-secondary font-medium">Type</label>
            <OptionSelect
              aria-label="Type"
              value={ord.type}
              onValueChange={(v) => updateOrdinary(idx, { type: v as OrdinaryType })}
              options={ORDINARIES}
            />
          </div>

          <div className="space-y-1">
            <label className="text-label-secondary font-medium">Line style</label>
            <OptionSelect
              aria-label="Line style"
              value={ord.lineStyle}
              onValueChange={(v) => updateOrdinary(idx, { lineStyle: v as LineStyle })}
              options={LINE_STYLES}
            />
          </div>

          <div className="border-separator space-y-1 border-t pt-2">
            <label className="text-label-secondary block font-medium">Tincture</label>
            <TincturePicker
              value={ord.tincture}
              onChange={(tinc) => updateOrdinary(idx, { tincture: tinc })}
            />
          </div>
        </div>
      </Card>
    );
  }

  // 4. Charge Properties
  if (selectedLayerPath.startsWith("shield.charges")) {
    const idx = parseIndices(selectedLayerPath);
    if (idx === null) return null;

    const charge = composition.shield.charges?.[idx];
    if (!charge) return null;

    return (
      <Card className="overflow-hidden">
        <div className="text-footnote flex flex-col gap-4 p-4">
          <Eyebrow className="border-separator block truncate border-b pb-2">
            Charge properties: {charge.chargeId}
          </Eyebrow>

          <div className="space-y-1">
            <label id="vexel-charge-count" className="text-label-secondary font-medium">
              Count ({charge.count})
            </label>
            <Slider
              aria-labelledby="vexel-charge-count"
              min={1}
              max={12}
              step={1}
              value={[charge.count]}
              onValueChange={([v]) => updateCharge(idx, { count: v ?? charge.count })}
              className="py-2"
            />
          </div>

          <div className="space-y-1">
            <label id="vexel-charge-size" className="text-label-secondary font-medium">
              Size ({charge.size.toFixed(2)}x)
            </label>
            <Slider
              aria-labelledby="vexel-charge-size"
              min={0.1}
              max={2.5}
              step={0.05}
              value={[charge.size]}
              onValueChange={([v]) => updateCharge(idx, { size: v ?? charge.size })}
              className="py-2"
            />
          </div>

          <div className="space-y-1">
            <label className="text-label-secondary font-medium">Attitude</label>
            <OptionSelect
              aria-label="Attitude"
              value={charge.attitude || ""}
              onValueChange={(v) => updateCharge(idx, { attitude: (v || undefined) as Attitude })}
              options={[{ value: "", label: "Default (None)" }, ...ATTITUDES]}
            />
          </div>

          <div className="border-separator flex items-center justify-between border-t pt-2">
            <label htmlFor="vexel-charge-mirrored" className="text-label-secondary font-medium">
              Mirrored
            </label>
            <Switch
              id="vexel-charge-mirrored"
              checked={!!charge.mirrored}
              onCheckedChange={(checked) => updateCharge(idx, { mirrored: checked })}
            />
          </div>

          <div className="border-separator space-y-1 border-t pt-2">
            <label className="text-label-secondary block font-medium">Tincture</label>
            <TincturePicker
              value={charge.tincture}
              onChange={(tinc) => updateCharge(idx, { tincture: tinc })}
            />
          </div>
        </div>
      </Card>
    );
  }

  // 5. External Ornament properties
  if (selectedLayerPath === "externals") {
    const ext = composition.externals || {};

    const handleMottoTextChange = (text: string) => {
      updateExternals({
        ...ext,
        motto: text ? { text, position: ext.motto?.position || "below" } : undefined,
      });
    };

    const handleMottoPositionChange = (pos: "above" | "below") => {
      if (ext.motto) {
        updateExternals({
          ...ext,
          motto: { ...ext.motto, position: pos },
        });
      }
    };

    const handleHelmToggle = (enabled: boolean) => {
      updateExternals({
        ...ext,
        helm: enabled ? { type: "great-helm", facing: "affronte" } : undefined,
      });
    };

    return (
      <Card className="overflow-hidden">
        <div className="text-footnote flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-4">
          <Eyebrow className="border-separator block border-b pb-2">Ornament properties</Eyebrow>

          {/* Helm toggle */}
          <div className="flex items-center justify-between">
            <label htmlFor="vexel-include-helm" className="text-label-secondary font-medium">
              Include helm
            </label>
            <Switch
              id="vexel-include-helm"
              checked={!!ext.helm}
              onCheckedChange={handleHelmToggle}
            />
          </div>

          {ext.helm && (
            <div className="border-separator space-y-1 border-l pl-3">
              <label className="text-label-secondary font-medium">Helm type</label>
              <OptionSelect
                aria-label="Helm type"
                value={ext.helm.type}
                onValueChange={(v) =>
                  updateExternals({
                    ...ext,
                    helm: { ...ext.helm!, type: v as HelmType },
                  })
                }
                options={HELM_TYPES}
              />
            </div>
          )}

          {/* Motto section */}
          <div className="border-separator space-y-2 border-t pt-2">
            <label className="text-label-secondary block font-semibold">Motto scroll</label>
            <div className="space-y-1">
              <label htmlFor="vexel-motto-text" className="text-label-secondary">
                Motto text
              </label>
              <Input
                id="vexel-motto-text"
                type="text"
                placeholder="e.g. In Hoc Signo Vinces"
                value={ext.motto?.text || ""}
                onChange={(e) => handleMottoTextChange(e.target.value)}
              />
            </div>

            {ext.motto && (
              <div className="border-separator space-y-1 border-l pl-3">
                <label className="text-label-secondary">Position</label>
                <OptionSelect
                  aria-label="Motto position"
                  value={ext.motto.position}
                  onValueChange={(v) => handleMottoPositionChange(v as "above" | "below")}
                  options={[
                    { value: "below", label: "Scroll below shield" },
                    { value: "above", label: "Scroll above shield" },
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
