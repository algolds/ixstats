"use client";

import { Check } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { FacetMaterial } from "~/components/ui/facet";
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
    <div className="border-border bg-card/40 mt-1 grid grid-cols-4 gap-1.5 rounded-lg border p-2">
      {Object.keys(TINCTURE_HEX).map((t) => {
        const key = t as Tincture;
        const color = TINCTURE_HEX[key];
        const isSelected = value === key;

        return (
          <button
            key={key}
            type="button"
            title={getTinctureLabel(key)}
            onClick={() => onChange(key)}
            className={`relative h-7 w-full rounded border transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
              isSelected
                ? "scale-105 border-amber-500 shadow-md"
                : "border-border opacity-70 hover:opacity-100"
            }`}
            style={{ backgroundColor: color }}
          >
            {isSelected && (
              <span className="bg-muted text-foreground absolute inset-0 flex items-center justify-center rounded text-xs font-bold">
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
      <FacetMaterial
        material="satin"
        className="border-border h-full overflow-hidden rounded-xl border"
      >
        <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-xs italic">
          Select a layer from the tree to edit properties
        </div>
      </FacetMaterial>
    );
  }

  // 1. Root Shield Properties
  if (selectedLayerPath === "shield") {
    return (
      <FacetMaterial material="satin" className="border-border overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 p-4 text-xs">
          <Eyebrow className="border-border block border-b pb-2">Shield Properties</Eyebrow>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Shape</label>
            <select
              value={composition.shield.shape}
              onChange={(e) =>
                updateComposition({
                  ...composition,
                  shield: { ...composition.shield, shape: e.target.value as ShieldShape },
                })
              }
              className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus:border-amber-500 focus:outline-none"
            >
              {SHIELD_SHAPES.map((shape) => (
                <option key={shape.value} value={shape.value}>
                  {shape.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FacetMaterial>
    );
  }

  // 2. Field Properties
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
      <FacetMaterial material="satin" className="border-border overflow-hidden rounded-xl border">
        <div className="flex max-h-[400px] flex-col gap-4 overflow-y-auto p-4 text-xs">
          <Eyebrow className="border-border block border-b pb-2">Field Properties</Eyebrow>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Division</label>
            <select
              value={field.division}
              onChange={(e) => handleDivisionChange(e.target.value as Division)}
              className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus:border-amber-500 focus:outline-none"
            >
              {DIVISIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Line Style</label>
            <select
              value={field.lineStyle}
              onChange={(e) => updateField({ ...field, lineStyle: e.target.value as LineStyle })}
              className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus:border-amber-500 focus:outline-none"
            >
              {LINE_STYLES.map((ls) => (
                <option key={ls.value} value={ls.value}>
                  {ls.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tincture pickers for divisions */}
          <div className="border-border space-y-3 border-t pt-2">
            <span className="text-muted-foreground block font-bold">
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
      </FacetMaterial>
    );
  }

  // 3. Ordinary Properties
  if (selectedLayerPath.startsWith("shield.ordinaries")) {
    const idx = parseIndices(selectedLayerPath);
    if (idx === null) return null;

    const ord = composition.shield.ordinaries?.[idx];
    if (!ord) return null;

    return (
      <FacetMaterial material="satin" className="border-border overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 p-4 text-xs">
          <Eyebrow className="border-border block border-b pb-2">
            Ordinary Properties ({idx + 1})
          </Eyebrow>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Type</label>
            <select
              value={ord.type}
              onChange={(e) => updateOrdinary(idx, { type: e.target.value as OrdinaryType })}
              className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus-visible:border-amber-500 focus-visible:outline-none"
            >
              {ORDINARIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Line Style</label>
            <select
              value={ord.lineStyle}
              onChange={(e) => updateOrdinary(idx, { lineStyle: e.target.value as LineStyle })}
              className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus-visible:border-amber-500 focus-visible:outline-none"
            >
              {LINE_STYLES.map((ls) => (
                <option key={ls.value} value={ls.value}>
                  {ls.label}
                </option>
              ))}
            </select>
          </div>

          <div className="border-border space-y-1 border-t pt-2">
            <label className="text-muted-foreground block font-medium">Tincture</label>
            <TincturePicker
              value={ord.tincture}
              onChange={(tinc) => updateOrdinary(idx, { tincture: tinc })}
            />
          </div>
        </div>
      </FacetMaterial>
    );
  }

  // 4. Charge Properties
  if (selectedLayerPath.startsWith("shield.charges")) {
    const idx = parseIndices(selectedLayerPath);
    if (idx === null) return null;

    const charge = composition.shield.charges?.[idx];
    if (!charge) return null;

    return (
      <FacetMaterial material="satin" className="border-border overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 p-4 text-xs">
          <Eyebrow className="border-border block truncate border-b pb-2">
            Charge Properties: {charge.chargeId}
          </Eyebrow>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Count ({charge.count})</label>
            <input
              type="range"
              min="1"
              max="12"
              value={charge.count}
              onChange={(e) => updateCharge(idx, { count: parseInt(e.target.value, 10) })}
              className="bg-card h-2 w-full cursor-pointer rounded-lg accent-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">
              Size ({charge.size.toFixed(2)}x)
            </label>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={charge.size}
              onChange={(e) => updateCharge(idx, { size: parseFloat(e.target.value) })}
              className="bg-card h-2 w-full cursor-pointer rounded-lg accent-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Attitude</label>
            <select
              value={charge.attitude || ""}
              onChange={(e) =>
                updateCharge(idx, { attitude: (e.target.value || undefined) as Attitude })
              }
              className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus-visible:border-amber-500 focus-visible:outline-none"
            >
              <option value="">Default (None)</option>
              {ATTITUDES.map((att) => (
                <option key={att.value} value={att.value}>
                  {att.label}
                </option>
              ))}
            </select>
          </div>

          <div className="border-border flex items-center justify-between border-t pt-2">
            <label className="text-muted-foreground font-medium">Mirrored</label>
            <input
              type="checkbox"
              checked={!!charge.mirrored}
              onChange={(e) => updateCharge(idx, { mirrored: e.target.checked })}
              className="border-border bg-card h-4 w-4 rounded text-amber-500 focus:ring-amber-500"
            />
          </div>

          <div className="border-border space-y-1 border-t pt-2">
            <label className="text-muted-foreground block font-medium">Tincture</label>
            <TincturePicker
              value={charge.tincture}
              onChange={(tinc) => updateCharge(idx, { tincture: tinc })}
            />
          </div>
        </div>
      </FacetMaterial>
    );
  }

  // 5. External Ornaments Properties
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
      <FacetMaterial material="satin" className="border-border overflow-hidden rounded-xl border">
        <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-4 text-xs">
          <Eyebrow className="border-border block border-b pb-2">Ornaments Properties</Eyebrow>

          {/* Helm toggle */}
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground font-medium">Include Helm</label>
            <input
              type="checkbox"
              checked={!!ext.helm}
              onChange={(e) => handleHelmToggle(e.target.checked)}
              className="border-border bg-card h-4 w-4 rounded text-amber-500 focus:ring-amber-500"
            />
          </div>

          {ext.helm && (
            <div className="border-border space-y-1 border-l pl-3">
              <label className="text-muted-foreground font-medium">Helm Type</label>
              <select
                value={ext.helm.type}
                onChange={(e) =>
                  updateExternals({
                    ...ext,
                    helm: { ...ext.helm!, type: e.target.value as HelmType },
                  })
                }
                className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus:outline-none"
              >
                {HELM_TYPES.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Motto section */}
          <div className="border-border space-y-2 border-t pt-2">
            <label className="text-muted-foreground block font-bold">Motto Scroll</label>
            <div className="space-y-1">
              <label className="text-muted-foreground">Motto Text</label>
              <input
                type="text"
                placeholder="e.g. In Hoc Signo Vinces"
                value={ext.motto?.text || ""}
                onChange={(e) => handleMottoTextChange(e.target.value)}
                className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus-visible:border-amber-500 focus-visible:outline-none"
              />
            </div>

            {ext.motto && (
              <div className="border-border space-y-1 border-l pl-3">
                <label className="text-muted-foreground">Position</label>
                <select
                  value={ext.motto.position}
                  onChange={(e) => handleMottoPositionChange(e.target.value as "above" | "below")}
                  className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus:outline-none"
                >
                  <option value="below">Scroll below shield</option>
                  <option value="above">Scroll above shield</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </FacetMaterial>
    );
  }

  return null;
}
