"use client";

import { forwardRef, useState } from "react";
import { Compass, Import, PageEdit } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  ARCHETYPE_OPTIONS,
  archetypeFacts,
  getArchetypeOption,
  type ArchetypeEra,
  type ArchetypeOption,
} from "../lib/founding-archetypes";
import { ArchetypeDetailsSheet } from "./ArchetypeDetailsSheet";
import { StepCard } from "./StepCard";

const ERA_OPTIONS = [
  { value: "modern" as const, label: "Modern" },
  { value: "historical" as const, label: "Historical" },
];

interface StartStepProps {
  selection: string | null;
  suggested: string | null;
  /** The imported page, when the player came through the wiki import. */
  importedTitle: string | null;
  onSelect: (key: string) => void;
  onImport: () => void;
  onBlank: () => void;
  error?: string;
}

/** "What kind of nation are you building?": the archetype grid, plus import and a blank start. */
export const StartStep = forwardRef<HTMLDivElement, StartStepProps>(function StartStep(
  { selection, suggested, importedTitle, onSelect, onImport, onBlank, error },
  headingRef
) {
  const [era, setEra] = useState<ArchetypeEra>(
    () => getArchetypeOption(selection ?? suggested)?.era ?? "modern"
  );
  const [details, setDetails] = useState<ArchetypeOption | null>(null);
  const shown = ARCHETYPE_OPTIONS.filter((option) => option.era === era);

  return (
    <StepCard
      ref={headingRef}
      id="founding-start"
      icon={<Compass />}
      title="What kind of nation are you building?"
      description="Each kind sets a starting size, wealth and government. You can change all of them in the next steps."
    >
      {importedTitle && (
        <p className="text-callout text-label-secondary">
          Imported from {importedTitle}.{" "}
          {suggested ? "The closest match is marked Suggested." : "Choose the closest match."}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <SegmentedControl
          aria-label="Era"
          value={era}
          onValueChange={setEra}
          options={ERA_OPTIONS}
          className="self-start"
        />
        <RadioCardGroup
          id="founding-start-choice"
          aria-labelledby="founding-start-title"
          aria-describedby={error ? "founding-start-error" : undefined}
          value={selection}
          onValueChange={onSelect}
          className="grid grid-cols-2 gap-2 lg:grid-cols-3"
        >
          {shown.map((option) => (
            <div key={option.key} className="flex min-w-0 flex-col gap-1">
              <RadioCard
                value={option.key}
                title={option.display.displayName}
                description={option.display.pitch}
                className="flex-1"
              >
                <span className="text-footnote text-label-tertiary mt-1 block">
                  {option.display.inspiration}
                </span>
                <span className="text-footnote text-label-secondary mt-2 flex flex-col gap-0.5">
                  {archetypeFacts(option).map((fact) => (
                    <span key={fact}>{fact}</span>
                  ))}
                </span>
                {option.key === suggested && (
                  <Badge variant="secondary" className="mt-2">
                    Suggested
                  </Badge>
                )}
              </RadioCard>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                aria-label={`Details: ${option.display.displayName}`}
                onClick={() => setDetails(option)}
              >
                Details
              </Button>
            </div>
          ))}
        </RadioCardGroup>
        {error && (
          <p id="founding-start-error" className="text-footnote text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="border-separator flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onImport}>
          <Import aria-hidden />
          Import from the wiki
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onBlank}>
          <PageEdit aria-hidden />
          Start blank
        </Button>
      </div>
      <ArchetypeDetailsSheet option={details} onOpenChange={(open) => !open && setDetails(null)} />
    </StepCard>
  );
});
