"use client";

import React from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";

const TRAITS = [
  {
    key: "postingFrequency",
    idSuffix: "posting-frequency",
    label: "Posting frequency",
    options: [
      { value: "low", label: "Low" },
      { value: "moderate", label: "Moderate" },
      { value: "active", label: "Active" },
    ],
  },
  {
    key: "politicalLean",
    idSuffix: "political-lean",
    label: "Political lean",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Center" },
      { value: "right", label: "Right" },
    ],
  },
  {
    key: "personality",
    idSuffix: "personality",
    label: "Personality",
    options: [
      { value: "serious", label: "Serious" },
      { value: "casual", label: "Casual" },
      { value: "satirical", label: "Satirical" },
    ],
  },
] as const;

export type PersonaTraitKey = (typeof TRAITS)[number]["key"];

interface PersonaTraitControlsProps {
  /** Prefix for the label ids, e.g. "tp-create" gives "tp-create-posting-frequency". */
  idPrefix: string;
  values: Record<PersonaTraitKey, string>;
  onChange: (key: PersonaTraitKey, value: string) => void;
  size?: "sm";
}

/** The posting frequency, political lean and personality selectors of a ThinkPages persona. */
export function PersonaTraitControls({
  idPrefix,
  values,
  onChange,
  size,
}: PersonaTraitControlsProps) {
  return (
    <>
      {TRAITS.map(({ key, idSuffix, label, options }) => {
        const labelId = `${idPrefix}-${idSuffix}`;
        return (
          <div key={key}>
            <span id={labelId} className="text-subhead text-label mb-2 block">
              {label}
            </span>
            <SegmentedControl
              aria-labelledby={labelId}
              size={size}
              fullWidth
              value={values[key]}
              onValueChange={(value: string) => onChange(key, value)}
              options={options}
            />
          </div>
        );
      })}
    </>
  );
}
