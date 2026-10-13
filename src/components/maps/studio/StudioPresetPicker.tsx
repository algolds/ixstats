"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { ValueSelect } from "~/components/ui/value-select";
import { isNoChange } from "~/lib/worldgen/studio-fields";
import { useStudio } from "./StudioContext";

/**
 * The preset in use. Picking another replaces every parameter with that preset's, so when the parameters are not the
 * current preset's own the admin is asked first: a mis-click must not lose an hour of tuning (the recipe is saved on
 * every change, so there would be no coming back).
 */
export function StudioPresetPicker() {
  const { presets, presetSlug, presetParams, params, pickPreset } = useStudio();
  const [asked, setAsked] = useState<string | null>(null);
  const edited = !isNoChange(presetParams, params);
  const target = presets.find((preset) => preset.slug === asked);

  return (
    <>
      <ValueSelect
        aria-label="Preset"
        size="sm"
        value={presetSlug}
        options={presets.map((preset): [string, string] => [
          preset.slug,
          preset.hasDraft ? `${preset.name} (draft)` : preset.name,
        ])}
        onValueChange={(slug) => (edited ? setAsked(slug) : pickPreset(slug))}
      />
      <AlertDialog open={asked !== null} onOpenChange={(open) => !open && setAsked(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {target?.name ?? "this preset"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the parameters you changed with the preset's own. The seed stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my changes</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (asked !== null) pickPreset(asked);
              }}
            >
              Switch preset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
