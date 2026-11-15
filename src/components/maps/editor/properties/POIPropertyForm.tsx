"use client";
import React from "react";
import { NavArrowDown } from "iconoir-react";
import type { POIFormData } from "~/hooks/useMapEditor";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { CoordinatePicker } from "./CoordinatePicker";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { POI_CATEGORY_OPTIONS } from "../optionLists";
import { Field, SubdivisionSelect, WikiLinkField, type PointFormProps } from "./fields";

const POI_ICONS = [
  { value: "castle", label: "Castle" },
  { value: "church", label: "Church" },
  { value: "mosque", label: "Mosque" },
  { value: "temple", label: "Temple" },
  { value: "monument", label: "Monument" },
  { value: "ruins", label: "Ruins" },
  { value: "mountain", label: "Mountain" },
  { value: "volcano", label: "Volcano" },
  { value: "forest", label: "Forest" },
  { value: "lake", label: "Lake" },
  { value: "port", label: "Port" },
  { value: "fortress", label: "Fortress" },
  { value: "university", label: "University" },
  { value: "factory", label: "Factory" },
  { value: "mine", label: "Mine" },
  { value: "bridge", label: "Bridge" },
  { value: "lighthouse", label: "Lighthouse" },
  { value: "stadium", label: "Stadium" },
  { value: "museum", label: "Museum" },
  { value: "palace", label: "Palace" },
];

const POI_ICON_OPTIONS = [{ value: "", label: "Icon (auto)" }, ...POI_ICONS];

const IMPORTANCE_OPTIONS = [
  { value: "0", label: "Normal (Standard marker)" },
  { value: "1", label: "Major (Prominent marker)" },
  { value: "2", label: "Legendary (Hero glow)" },
];

export const POIPropertyForm = React.memo(function POIPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
  countryId,
  isPickingLocation = false,
  setIsPickingLocation,
}: PointFormProps<POIFormData>) {
  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className="text-footnote h-8 px-2.5"
        autoFocus
      />
      <OptionSelect
        aria-label="Category"
        value={form.category}
        onValueChange={(v) => onChange({ ...form, category: v })}
        options={POI_CATEGORY_OPTIONS}
        size="sm"
        className="w-full"
      />
      <OptionSelect
        aria-label="Icon"
        size="sm"
        value={form.icon ?? ""}
        onValueChange={(v) => onChange({ ...form, icon: v || undefined })}
        options={POI_ICON_OPTIONS}
      />

      {countryId && (
        <CoordinatePicker
          coordinates={form.coordinates ?? pendingCoordinates}
          isPickingLocation={isPickingLocation}
          setIsPickingLocation={setIsPickingLocation}
        />
      )}
      <Textarea
        placeholder="Description (optional)"
        value={form.description ?? ""}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        rows={2}
        className="text-footnote min-h-16 px-2.5 py-2"
      />
      <WikiLinkField
        form={form}
        onChange={onChange}
        currentCoords={pendingCoordinates ?? undefined}
      />
      <SubdivisionSelect
        value={form.subdivisionId}
        onChange={(subdivisionId) => onChange({ ...form, subdivisionId })}
        allFeatures={allFeatures}
      />

      <details className="border-separator bg-fill-4 group rounded-control border p-2">
        <summary className="text-label-secondary hover:text-label text-caption flex cursor-pointer items-center justify-between font-medium select-none">
          <span>Historical story & lore (optional)</span>
          <NavArrowDown className="text-label-secondary h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-separator mt-2 space-y-2 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="IxTime year">
              <Input
                type="number"
                placeholder="e.g. 1420"
                value={form.ixTimeYear ?? ""}
                onChange={(e) =>
                  onChange({
                    ...form,
                    ixTimeYear: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                  })
                }
                className="text-footnote h-8 px-2.5 tabular-nums"
              />
            </Field>
            <Field label="Era label">
              <Input
                type="text"
                placeholder="e.g. Bronze Age"
                value={form.eraLabel ?? ""}
                onChange={(e) => onChange({ ...form, eraLabel: e.target.value || undefined })}
                className="text-footnote h-8 px-2.5"
              />
            </Field>
          </div>
          <Field label="Importance level">
            <OptionSelect
              aria-label="Importance level"
              value={String(form.importance ?? 0)}
              onValueChange={(v) => onChange({ ...form, importance: parseInt(v, 10) || 0 })}
              options={IMPORTANCE_OPTIONS}
              size="sm"
              className="w-full"
            />
          </Field>
          <Field label="Story narrative (Markdown)">
            <Textarea
              placeholder="Narrative lore or historical chronicle..."
              value={form.storyContent ?? ""}
              onChange={(e) => onChange({ ...form, storyContent: e.target.value || undefined })}
              rows={3}
              className="text-footnote min-h-20 px-2.5 py-2"
            />
          </Field>
        </div>
      </details>
    </div>
  );
});
