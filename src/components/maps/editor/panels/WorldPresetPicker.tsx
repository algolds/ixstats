"use client";

import { SegmentedControl } from "~/components/ui/segmented-control";
import { ValueSelect } from "~/components/ui/value-select";
import { useWorldPresets } from "../hooks/useWorldPresets";

interface WorldPresetPickerProps {
  /** Slug of the chosen preset */
  value: string;
  onValueChange: (slug: string) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/** More presets than this do not fit side by side in the panel, so they are chosen from a list instead. */
const MAX_SEGMENTS = 3;

/** A choice among the published presets, by the names the admin gave them. */
export function WorldPresetPicker({ value, onValueChange, ...label }: WorldPresetPickerProps) {
  const { presets } = useWorldPresets();
  if (!presets) return <p className="text-label-secondary text-caption">Loading the presets.</p>;
  if (presets.length > MAX_SEGMENTS) {
    return (
      <ValueSelect
        {...label}
        size="sm"
        className="w-full"
        value={value}
        onValueChange={onValueChange}
        options={presets.map(({ slug, name }) => [slug, name] as const)}
      />
    );
  }
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
