"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type { CommonsImage } from "./types";

export type CopyFormat = "thumb" | "embed" | "raw" | "url";

/** Wikitext (or URL) to copy for an image in the chosen format. */
export function copyFormatText(format: CopyFormat, image: CommonsImage): string {
  switch (format) {
    case "thumb":
      return `[[${image.title}|thumb|${image.title.replace(/^File:/, "").replace(/_/g, " ")}]]`;
    case "embed":
      return `[[${image.title}|250px]]`;
    case "raw":
      return `[[${image.title}]]`;
    case "url":
      return image.url;
  }
}

export function CopyFormatSelector({
  value,
  onValueChange,
}: {
  value: CopyFormat;
  onValueChange: (format: CopyFormat) => void;
}) {
  return (
    <div className="space-y-2">
      <Eyebrow>Wikitext copy format</Eyebrow>
      <SegmentedControl
        aria-label="Wikitext copy format"
        size="sm"
        fullWidth
        value={value}
        onValueChange={onValueChange}
        options={[
          { value: "thumb", label: "Thumb" },
          { value: "embed", label: "Embed" },
          { value: "raw", label: "File" },
          { value: "url", label: "URL" },
        ]}
      />
    </div>
  );
}
