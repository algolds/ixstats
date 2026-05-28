"use client";

import React from "react";
import { Label } from "~/components/ui/label";
import { ColorPickerInput } from "~/components/kibo-ui/color-picker";
import type { MapLabelFormData } from "~/hooks/useMapEditor";

const MAP_LABEL_TYPES = [
  { value: "mountain_range", label: "Mountain Range" },
  { value: "strait", label: "Strait" },
  { value: "bay", label: "Bay" },
  { value: "peninsula", label: "Peninsula" },
  { value: "plateau", label: "Plateau" },
  { value: "valley", label: "Valley" },
  { value: "desert", label: "Desert" },
  { value: "sea", label: "Sea" },
  { value: "region", label: "Region" },
  { value: "historical", label: "Historical" },
];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

interface MapLabelPropertyFormProps {
  form: MapLabelFormData;
  onChange: (form: MapLabelFormData) => void;
}

export const MapLabelPropertyForm = React.memo(function MapLabelPropertyForm({
  form,
  onChange,
}: MapLabelPropertyFormProps) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Label text"
        value={form.text}
        onChange={(e) => onChange({ ...form, text: e.target.value })}
        className={inputClasses}
        autoFocus
      />
      <select
        value={form.labelType}
        onChange={(e) => onChange({ ...form, labelType: e.target.value })}
        className={selectClasses}
      >
        {MAP_LABEL_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="space-y-1.5">
        <label className="text-foreground/80 flex items-center justify-between text-xs">
          <span>Font Size</span>
          <span className="text-muted-foreground tabular-nums">{form.fontSize}px</span>
        </label>
        <input
          type="range"
          min={8}
          max={48}
          value={form.fontSize}
          onChange={(e) => onChange({ ...form, fontSize: parseInt(e.target.value, 10) })}
          className="w-full"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-foreground/80 text-xs">Color</Label>
        <ColorPickerInput
          value={form.color}
          onChange={(val) => onChange({ ...form, color: val })}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-foreground/80 flex items-center justify-between text-xs">
          <span>Rotation</span>
          <span className="text-muted-foreground tabular-nums">{form.rotation}&deg;</span>
        </label>
        <input
          type="range"
          min={-180}
          max={180}
          value={form.rotation}
          onChange={(e) => onChange({ ...form, rotation: parseInt(e.target.value, 10) })}
          className="w-full"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-foreground/80 flex items-center justify-between text-xs">
          <span>Letter Spacing</span>
          <span className="text-muted-foreground tabular-nums">
            {form.letterSpacing.toFixed(2)}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={form.letterSpacing}
          onChange={(e) => onChange({ ...form, letterSpacing: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>
      <label className="text-foreground/80 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.fontWeight === "bold"}
          onChange={(e) => onChange({ ...form, fontWeight: e.target.checked ? "bold" : "normal" })}
          className="border-border text-primary focus:ring-primary rounded"
        />
        Bold
      </label>
      <div className="space-y-1.5">
        <label className="text-foreground/80 flex items-center justify-between text-xs">
          <span>Opacity</span>
          <span className="text-muted-foreground tabular-nums">{form.opacity.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.1}
          value={form.opacity}
          onChange={(e) => onChange({ ...form, opacity: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  );
});
