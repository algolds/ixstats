"use client";
import React from "react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { Card } from "~/components/ui/card";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { WikiLinkWizard } from "../WikiLinkWizard";

export const inputClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 sm:py-2 text-body sm:text-body text-label placeholder:text-label-secondary transition-colors focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

export interface PointFormProps<T> {
  form: T;
  onChange: (form: T) => void;
  pendingCoordinates?: [number, number] | null;
  allFeatures?: EditorFeature[];
  countryId?: string;
  isPickingLocation?: boolean;
  setIsPickingLocation?: (active: boolean) => void;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-label-secondary text-caption mb-1 block text-left">{label}</label>
      {children}
    </div>
  );
}

export function SubdivisionSelect({
  value,
  onChange,
  allFeatures,
  ariaLabel = "Subdivision",
}: {
  value: string | undefined;
  onChange: (subdivisionId: string | undefined) => void;
  allFeatures: EditorFeature[] | undefined;
  ariaLabel?: string;
}) {
  const options = React.useMemo(
    () => [
      { value: "auto", label: "&mdash; Auto-detect Region (Recommended) &mdash;" },
      { value: "none", label: "&mdash; None &mdash;" },
      ...(allFeatures ?? [])
        .filter((f) => f.type === "subdivision")
        .map((sub) => ({ value: sub.id, label: sub.name })),
    ],
    [allFeatures]
  );
  return (
    <OptionSelect
      aria-label={ariaLabel}
      value={value ?? "auto"}
      onValueChange={(v) => onChange(v || undefined)}
      options={options}
      size="sm"
      className="w-full"
    />
  );
}

/** Wiki search/link field; `importPopulation` also copies an imported population into the form. */
export function WikiLinkField<T extends { wikiPageTitle?: string }>({
  form,
  onChange,
  currentCoords,
  importPopulation = false,
}: {
  form: T;
  onChange: (form: T) => void;
  currentCoords?: [number, number];
  importPopulation?: boolean;
}) {
  return (
    <WikiLinkWizard
      value={form.wikiPageTitle}
      onChange={(title) => onChange({ ...form, wikiPageTitle: title })}
      onImport={(fields) =>
        onChange({
          ...form,
          wikiPageTitle: fields.wikiPageTitle,
          ...(importPopulation && fields.population ? { population: fields.population } : {}),
        })
      }
      currentCoords={currentCoords}
      placeholder="Search wiki to link..."
    />
  );
}

/** Drawn / not-drawn status card for polygon and line features. */
export function GeometryStatus({
  label,
  hasGeom,
  measure,
  missing,
  hint,
}: {
  label: string;
  hasGeom: boolean;
  measure: string | undefined;
  missing: string;
  hint: string;
}) {
  return (
    <Card className="text-footnote px-3 py-2">
      <div className="text-label-secondary text-left font-medium">
        {label}:{" "}
        {hasGeom ? (
          <span className="text-label font-semibold">Drawn {measure && `(${measure})`}</span>
        ) : (
          <span className="text-yellow italic">{missing}</span>
        )}
      </div>
      {!hasGeom && <div className="text-label-secondary text-footnote mt-1 text-left">{hint}</div>}
    </Card>
  );
}
