"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { ValueSelect } from "~/components/ui/value-select";

export interface PresetOption {
  id: string;
  label: string;
  description: string | null;
}

const FIELD_NAMES: Record<string, string> = {
  art: "art",
  rasters: "raster layers",
  physical: "physical layers",
  labels: "labels",
  flags: "flags",
  defaultView: "default view",
  coverage: "smoothing",
};

const fieldList = (fields: readonly string[]) =>
  fields.map((f) => FIELD_NAMES[f] ?? f).join(", ") || "nothing";

function confirmText(force: boolean, dirty: boolean): string | null {
  const parts = [
    force && "Every field of the preset replaces this realm's config, its own art included.",
    dirty && "Your unsaved changes here are lost.",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Load a source preset's map pipeline into the realm: empty fields only, or everything with "Replace everything"
 * (confirmed). It is saved at once; unsaved edits in the form are dropped (confirmed).
 */
export function PresetLoader({
  slug,
  presets,
  allowForce,
  dirty,
  onLoaded,
}: {
  slug: string;
  presets: PresetOption[];
  allowForce: boolean;
  dirty: boolean;
  onLoaded: () => void;
}) {
  const notify = useNotify();
  const [presetId, setPresetId] = useState(presets[0]?.id);
  const [force, setForce] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const load = api.realms.mapPipeline.loadPreset.useMutation({
    onSuccess: (result) => {
      notify.success(
        "Preset loaded",
        `Filled: ${fieldList(result.filled)}. Kept: ${fieldList(result.kept)}.`
      );
      setConfirming(false);
      onLoaded();
    },
    onError: (e) => notify.error("Could not load the preset", e.message),
  });
  const warning = confirmText(force && allowForce, dirty);
  const run = () => presetId && load.mutate({ realm: slug, presetId, force: force && allowForce });
  const chosen = presets.find((p) => p.id === presetId);

  if (presets.length === 0)
    return <p className="text-label-secondary text-body">No preset carries a map pipeline yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-col gap-2">
          <Label htmlFor="pipeline-preset">Preset</Label>
          <ValueSelect
            id="pipeline-preset"
            value={presetId}
            options={presets.map((p) => [p.id, p.label] as const)}
            onValueChange={setPresetId}
          />
        </div>
        {allowForce && (
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="pipeline-preset-force"
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
            />
            <Label htmlFor="pipeline-preset-force">Replace everything</Label>
          </div>
        )}
        <Button
          variant="outline"
          disabled={!presetId || load.isPending}
          onClick={() => (warning ? setConfirming(true) : run())}
        >
          {load.isPending ? "Loading…" : "Load preset"}
        </Button>
      </div>
      {chosen?.description && (
        <p className="text-label-secondary text-footnote">{chosen.description}</p>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Load {chosen?.label ?? "the preset"}?</AlertDialogTitle>
            <AlertDialogDescription>{warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={load.isPending} onClick={run}>
              Load preset
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
