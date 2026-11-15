"use client";

/**
 * The one wiki picker: Wiki, IIWiki, AltHistory Wiki. A wiki that cannot answer right now (the IIWiki switch, or its
 * breaker) is listed but disabled, with the reason under the control, and is never the selected one.
 * `useWikiSource` holds the choice and reads the availability; `WikiSourcePicker` draws it.
 */
import { useId, useState } from "react";
import { api } from "~/trpc/react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { cn } from "~/lib/utils/cn";
import type { WikiSource } from "~/lib/wiki-os/config";
import type { IiwikiFeature } from "~/lib/wiki-os/iiwiki-switch";
import {
  WIKI_SOURCE_IDS,
  selectedWikiSource,
  wikiSourceOptions,
  type WikiSourceOption,
} from "~/lib/wiki-os/wiki-source-availability";

/** The availability is cheap to read and changes rarely: ask again after this long. */
const AVAILABILITY_STALE_MS = 30_000;

export interface WikiSourceChoice {
  /** The wiki in use: what the reader picked while it can be picked, else the first wiki that can. */
  source: WikiSource;
  setSource: (source: WikiSource) => void;
  options: WikiSourceOption[];
}

/**
 * A wiki choice for `feature` (the IIWiki switch feature the caller's reads are tagged with). `sources` narrows the
 * list (a realm's map looks pages up in its own wikis); `initial` is a stored choice.
 */
export function useWikiSource(
  feature: IiwikiFeature,
  sources: readonly WikiSource[] = WIKI_SOURCE_IDS,
  initial: WikiSource | null = null
): WikiSourceChoice {
  const [picked, setPicked] = useState<WikiSource | null>(initial);
  const availability = api.wikios.iiwikiAvailability.useQuery(undefined, {
    staleTime: AVAILABILITY_STALE_MS,
  });
  const options = wikiSourceOptions(sources, availability.data, feature);
  return { source: selectedWikiSource(picked, options), setSource: setPicked, options };
}

interface WikiSourcePickerProps {
  value: WikiSource;
  onValueChange: (source: WikiSource) => void;
  options: readonly WikiSourceOption[];
  /** @default "md" */
  size?: "sm" | "md";
  className?: string;
}

export function WikiSourcePicker({
  value,
  onValueChange,
  options,
  size,
  className,
}: WikiSourcePickerProps) {
  const reasonId = useId();
  const reasons = [...new Set(options.flatMap((option) => (option.reason ? [option.reason] : [])))];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <SegmentedControl
        aria-label="Wiki"
        aria-describedby={reasons.length > 0 ? reasonId : undefined}
        value={value}
        onValueChange={onValueChange}
        options={options.map(({ value: source, label, disabled }) => ({
          value: source,
          label,
          disabled,
        }))}
        size={size}
        fullWidth
      />
      {reasons.length > 0 && (
        <p id={reasonId} className="text-footnote text-label-secondary">
          {reasons.join(" ")}
        </p>
      )}
    </div>
  );
}
