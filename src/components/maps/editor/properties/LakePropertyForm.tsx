"use client";

import React from "react";
import type { NamedLakeFormData, EditorFeature } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

interface LakePropertyFormProps {
  form: NamedLakeFormData;
  onChange: (form: NamedLakeFormData) => void;
  pendingGeometry?: object | null;
  selectedFeature?: EditorFeature | null;
}

export const LakePropertyForm = React.memo(function LakePropertyForm({
  form,
  onChange,
  pendingGeometry,
  selectedFeature,
}: LakePropertyFormProps) {
  const hasGeom = !!(form.geometry ?? pendingGeometry ?? selectedFeature?.geometry);
  const areaSqKm = selectedFeature?.properties?.areaSqKm as number | undefined;

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Lake Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      <div>
        <label className="text-muted-foreground mb-1 block text-left text-xs font-medium">
          Max Depth (meters, optional)
        </label>
        <input
          type="number"
          placeholder="e.g. 150"
          value={form.maxDepthM ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              maxDepthM:
                e.target.value === "" ? undefined : parseFloat(e.target.value) || undefined,
            })
          }
          className={inputClasses}
        />
      </div>

      <div className="border-border/60 bg-muted/20 rounded-lg border px-3 py-2 text-xs">
        <div className="text-muted-foreground text-left font-medium">
          Polygon Geometry:{" "}
          {hasGeom ? (
            <span className="text-foreground font-semibold">
              Drawn {areaSqKm !== undefined && `(${areaSqKm.toFixed(2)} km²)`}
            </span>
          ) : (
            <span className="text-amber-500 italic">Not drawn yet (use Polygon tool)</span>
          )}
        </div>
        {!hasGeom && (
          <div className="text-muted-foreground mt-1 text-left text-[10px]">
            Use the polygon drawing tool in the map controls to trace the contours of the lake.
          </div>
        )}
      </div>

      <WikiLinkWizard
        value={form.wikiPageTitle}
        onChange={(title) => onChange({ ...form, wikiPageTitle: title })}
        onImport={(fields) => {
          onChange({ ...form, wikiPageTitle: fields.wikiPageTitle });
        }}
        placeholder="Search wiki to link..."
      />
    </div>
  );
});
