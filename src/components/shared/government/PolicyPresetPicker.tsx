"use client";

import { useState } from "react";
import type { ComponentType } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { ValueSelect } from "~/components/ui/value-select";
import {
  POLICY_PRESETS,
  getPolicyPreset,
  presetReplacesChoices,
} from "~/lib/government/policy-presets";

const institutions = (count: number) => (count === 1 ? "1 institution" : `${count} institutions`);

const OPTIONS = POLICY_PRESETS.map((preset) => [preset.id, preset.name] as const);

interface PolicyPresetPickerProps {
  /** Prefixes the ids in the picker, so two pickers never share one. */
  idPrefix: string;
  /** The institutions the player chose themselves; replacing any of them asks first. */
  currentChoices: readonly string[];
  /** Applies the preset's whole set in one update. */
  onApply: (components: ComponentType[], presetId: string) => void;
  /** Turns a component type into its plain name for the preset's summary. */
  componentName: (type: ComponentType) => string;
  headingLevel?: "h3" | "h4";
}

/**
 * Policy presets (spec §4): one of the 55 government templates, applied as the whole institution
 * set in one update, after a confirm when it would replace the player's own choices.
 */
export function PolicyPresetPicker({
  idPrefix,
  currentChoices,
  onApply,
  componentName,
  headingLevel: Heading = "h3",
}: PolicyPresetPickerProps) {
  const [presetId, setPresetId] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const preset = presetId ? getPolicyPreset(presetId) : undefined;
  const headingId = `${idPrefix}-presets`;

  const apply = () => {
    if (!preset) return;
    setConfirming(false);
    onApply(preset.components, preset.id);
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby={headingId}>
      <div className="flex flex-col gap-1">
        <Heading id={headingId} className="text-headline text-label">
          Policy presets
        </Heading>
        <p className="text-footnote text-label-secondary">
          Start from a ready-made set of institutions. A preset replaces the set chosen now.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ValueSelect
          id={`${idPrefix}-preset`}
          aria-labelledby={headingId}
          value={presetId}
          onValueChange={setPresetId}
          options={OPTIONS}
          placeholder="Choose a preset"
          className="sm:w-72"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!preset}
          onClick={() =>
            preset && presetReplacesChoices(currentChoices, preset.components)
              ? setConfirming(true)
              : apply()
          }
        >
          Use preset
        </Button>
      </div>
      {preset && (
        <p className="text-footnote text-label-secondary" aria-live="polite">
          {preset.description}. Sets {institutions(preset.components.length)}:{" "}
          {preset.components.map((type) => componentName(type).toLowerCase()).join(", ")}.
        </p>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your institutions?</AlertDialogTitle>
            <AlertDialogDescription>
              {preset?.name} replaces the {institutions(currentChoices.length)} you chose with its
              own {preset?.components.length}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep mine</AlertDialogCancel>
            <Button type="button" onClick={apply}>
              Replace
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
