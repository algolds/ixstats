"use client";

import { SegmentedControl } from "~/components/ui/segmented-control";
import { useWorldPresets } from "../hooks/useWorldPresets";

interface WorldPresetPickerProps {
  /** Slug of the chosen preset */
  value: string;
  onValueChange: (slug: string) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/** A choice among the published presets, by the names the admin gave them. */
export function WorldPresetPicker({ value, onValueChange, ...label }: WorldPresetPickerProps) {
  const { presets } = useWorldPresets();
  if (!presets) return <p className="text-label-secondary text-caption">Loading the presets.</p>;
  return (
    <SegmentedControl
      {...label}
      size="sm"
      fullWidth
      value={value}
      onValueChange={onValueChange}
      options={presets.map(({ slug, name }) => ({ value: slug, label: name }))}
    />
  );
}
