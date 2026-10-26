"use client";

import { SegmentedControl } from "~/components/ui/segmented-control";
import { readerWikiOfUrl } from "~/lib/wiki-os/wiki-link-target";
import type { CommonsImage } from "./types";

export type CopyFormat = "link" | "thumb" | "embed" | "raw" | "url";

/** The formats a file can be copied in; the first is the one a panel starts on. */
export type CopyFormats = readonly [CopyFormat, ...CopyFormat[]];

const WIKITEXT_FORMATS: CopyFormats = ["thumb", "embed", "raw", "url"];
/** A sister wiki's file is not IxWiki's: `[[File:X]]` would name a file IxWiki does not have. */
const SISTER_FORMATS: CopyFormats = ["link", "url"];

const LABELS: Record<CopyFormat, string> = {
  link: "Link",
  thumb: "Thumb",
  embed: "Embed",
  raw: "File",
  url: "URL",
};

/**
 * The formats `image` can be copied in: a file whose page is on a sister wiki WikiOS reads copies a link to that
 * page (or its URL); a Commons, IxWiki or own upload keeps the wikitext formats.
 */
export function copyFormatsFor(image: CommonsImage): CopyFormats {
  const wiki = readerWikiOfUrl(image.descriptionUrl);
  return wiki && wiki !== "ixwiki" ? SISTER_FORMATS : WIKITEXT_FORMATS;
}

/** Wikitext (or URL) to copy for an image in the chosen format. */
export function copyFormatText(format: CopyFormat, image: CommonsImage): string {
  const caption = image.title.replace(/^File:/, "").replace(/_/g, " ");
  switch (format) {
    case "link":
      return `[${image.descriptionUrl} ${caption}]`;
    case "thumb":
      return `[[${image.title}|thumb|${caption}]]`;
    case "embed":
      return `[[${image.title}|250px]]`;
    case "raw":
      return `[[${image.title}]]`;
    case "url":
      return image.url;
  }
}

export function CopyFormatSelector({
  formats,
  value,
  onValueChange,
}: {
  formats: readonly CopyFormat[];
  value: CopyFormat;
  onValueChange: (format: CopyFormat) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-label-secondary text-footnote">Wikitext copy format</p>
      <SegmentedControl
        aria-label="Wikitext copy format"
        size="sm"
        fullWidth
        value={value}
        onValueChange={onValueChange}
        options={formats.map((format) => ({ value: format, label: LABELS[format] }))}
      />
    </div>
  );
}
