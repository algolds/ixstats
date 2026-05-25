"use client";

import React from "react";
import type { POIFormData, EditorFeature } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";

const POI_CATEGORIES = [
  "landmark",
  "historical",
  "natural",
  "religious",
  "military",
  "cultural",
  "economic",
  "educational",
  "monument",
  "ruins",
];

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

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

interface POIPropertyFormProps {
  form: POIFormData;
  onChange: (form: POIFormData) => void;
  pendingCoordinates?: [number, number] | null;
  allFeatures?: EditorFeature[];
}

export const POIPropertyForm = React.memo(function POIPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
}: POIPropertyFormProps) {
  const subdivisions = (allFeatures ?? []).filter((f) => f.type === "subdivision");
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
      <select
        value={form.category}
        onChange={(e) => onChange({ ...form, category: e.target.value })}
        className={selectClasses}
      >
        {POI_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>
      <select
        value={form.icon ?? ""}
        onChange={(e) => onChange({ ...form, icon: e.target.value || undefined })}
        className={selectClasses}
      >
        <option value="">Icon (auto)</option>
        {POI_ICONS.map((ic) => (
          <option key={ic.value} value={ic.value}>
            {ic.emoji} {ic.label}
          </option>
        ))}
      </select>
      <textarea
        placeholder="Description (optional)"
        value={form.description ?? ""}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        rows={2}
        className={inputClasses}
      />
      <WikiLinkWizard
        value={form.wikiPageTitle}
        onChange={(title) => onChange({ ...form, wikiPageTitle: title })}
        onImport={(fields) => {
          onChange({ ...form, wikiPageTitle: fields.wikiPageTitle });
        }}
        currentCoords={pendingCoordinates ?? undefined}
        placeholder="Search wiki to link..."
      />
      {subdivisions.length > 0 && (
        <select
          value={form.subdivisionId ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              subdivisionId: e.target.value || undefined,
            })
          }
          className={selectClasses}
        >
          <option value="">&mdash; No region &mdash;</option>
          {subdivisions.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
});
