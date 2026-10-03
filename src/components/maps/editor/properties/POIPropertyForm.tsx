"use client";
import React from "react";
import type { POIFormData } from "~/hooks/useMapEditor";
import { CoordinatePicker } from "./CoordinatePicker";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { POI_CATEGORY_OPTIONS } from "../optionLists";
import {
  Field,
  inputClasses,
  SubdivisionSelect,
  WikiLinkField,
  type PointFormProps,
} from "./fields";

const POI_ICONS = [
  { value: "castle", emoji: "\u{1F3F0}", label: "Castle" },
  { value: "church", emoji: "\u26EA", label: "Church" },
  { value: "mosque", emoji: "\u{1F54C}", label: "Mosque" },
  { value: "temple", emoji: "\u26E9\uFE0F", label: "Temple" },
  { value: "monument", emoji: "\u{1F5FD}", label: "Monument" },
  { value: "ruins", emoji: "\u{1F3DB}\uFE0F", label: "Ruins" },
  { value: "mountain", emoji: "\u26F0\uFE0F", label: "Mountain" },
  { value: "volcano", emoji: "\u{1F30B}", label: "Volcano" },
  { value: "forest", emoji: "\u{1F332}", label: "Forest" },
  { value: "lake", emoji: "\u{1F4A7}", label: "Lake" },
  { value: "port", emoji: "\u2693", label: "Port" },
  { value: "fortress", emoji: "\u{1F3EF}", label: "Fortress" },
  { value: "university", emoji: "\u{1F393}", label: "University" },
  { value: "factory", emoji: "\u{1F3ED}", label: "Factory" },
  { value: "mine", emoji: "\u26CF\uFE0F", label: "Mine" },
  { value: "bridge", emoji: "\u{1F309}", label: "Bridge" },
  { value: "lighthouse", emoji: "\u{1F5FC}", label: "Lighthouse" },
  { value: "stadium", emoji: "\u{1F3DF}\uFE0F", label: "Stadium" },
  { value: "museum", emoji: "\u{1F3DB}\uFE0F", label: "Museum" },
  { value: "palace", emoji: "\u{1F451}", label: "Palace" },
];

const POI_ICON_OPTIONS = [
  { value: "", label: "Icon (auto)" },
  ...POI_ICONS.map((ic) => ({ value: ic.value, label: `${ic.emoji} ${ic.label}` })),
];

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
      <input
        type="text"
        placeholder="Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
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
      <textarea
        placeholder="Description (optional)"
        value={form.description ?? ""}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        rows={2}
        className={inputClasses}
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
        <summary className="text-label-secondary hover:text-label text-caption flex cursor-pointer items-center justify-between font-semibold select-none">
          <span>Historical Story & Lore (Optional)</span>
          <span className="text-label-secondary text-footnote transition-transform group-open:rotate-180">
            &#9660;
          </span>
        </summary>
        <div className="border-separator mt-2 space-y-2 border-t pt-1">
          <div className="grid grid-cols-2 gap-2">
            <Field label="IxTime Year">
              <input
                type="number"
                placeholder="e.g. 1420"
                value={form.ixTimeYear ?? ""}
                onChange={(e) =>
                  onChange({
                    ...form,
                    ixTimeYear: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                  })
                }
                className={inputClasses}
              />
            </Field>
            <Field label="Era label">
              <input
                type="text"
                placeholder="e.g. Bronze Age"
                value={form.eraLabel ?? ""}
                onChange={(e) => onChange({ ...form, eraLabel: e.target.value || undefined })}
                className={inputClasses}
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
          <Field label="Story Narrative (Markdown)">
            <textarea
              placeholder="Narrative lore or historical chronicle..."
              value={form.storyContent ?? ""}
              onChange={(e) => onChange({ ...form, storyContent: e.target.value || undefined })}
              rows={3}
              className={inputClasses}
            />
          </Field>
        </div>
      </details>
    </div>
  );
});
