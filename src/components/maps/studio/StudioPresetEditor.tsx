"use client";

import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { StudioPreset } from "~/lib/worldgen/studio-presets";
import { StudioConfirm } from "./StudioConfirm";

interface StudioPresetEditorProps {
  preset: StudioPreset;
  /** The rail holds changes that the preset's saved values do not */
  dirty: boolean;
  locked: boolean;
  onSaveDraft: () => void;
  onSaveNew: (name: string) => void;
  onPublish: () => void;
  onReset: () => void;
  onRename: (name: string) => void;
  onArchive: () => void;
}

/** A name field with its button: used to rename the preset and to save the rail as a new one. */
function NameForm({
  label,
  action,
  initial,
  disabled,
  onSubmit,
}: {
  label: string;
  action: string;
  initial: string;
  disabled: boolean;
  onSubmit: (name: string) => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <label htmlFor={id} className="text-label-secondary text-caption block">
          {label}
        </label>
        <Input
          id={id}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          className="text-footnote h-(--control-height-sm)"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={disabled || trimmed === "" || (action === "Rename" && trimmed === initial)}
      >
        {action}
      </Button>
    </form>
  );
}

function stateText(preset: StudioPreset): string {
  if (preset.hasDraft) {
    return preset.published
      ? "A draft is saved. Founders see the published version until you publish it."
      : "A draft is saved. Founders cannot pick this preset until you publish it.";
  }
  return preset.published ? "Published, with no draft." : "Not published and no draft.";
}

/** What can be done to the selected preset with the rail's parameters (never a seed). */
export function StudioPresetEditor({
  preset,
  dirty,
  locked,
  onSaveDraft,
  onSaveNew,
  onPublish,
  onReset,
  onRename,
  onArchive,
}: StudioPresetEditorProps) {
  return (
    <section aria-label={`${preset.name} preset`} className="space-y-3">
      <h4 className="text-footnote font-medium">{preset.name}</h4>
      <p className="text-label-secondary text-caption">{stateText(preset)}</p>
      {dirty && (
        <p role="status" className="text-label-secondary text-caption">
          The rail has changes this preset does not. Save the draft to keep them.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={locked} onClick={onSaveDraft}>
          Save draft
        </Button>
        <StudioConfirm
          label="Publish"
          title={`Publish ${preset.name}?`}
          description="Founders see the saved draft the next time they open the World tab. Changes in the rail that are not saved are not included."
          disabled={locked || !preset.hasDraft}
          onConfirm={onPublish}
        />
        {preset.builtIn && (
          <StudioConfirm
            label="Reset to factory"
            title={`Reset ${preset.name} to factory?`}
            description="This starts a new draft from the values in code and replaces the draft now saved. The published version stays until you publish."
            disabled={locked}
            onConfirm={onReset}
          />
        )}
        {!preset.builtIn && (
          <StudioConfirm
            label="Archive"
            title={`Archive ${preset.name}?`}
            description="Founders can no longer pick it and it leaves this list. Its versions are kept."
            variant="destructive"
            disabled={locked}
            onConfirm={onArchive}
          />
        )}
      </div>
      <NameForm
        key={`rename:${preset.slug}:${preset.name}`}
        label="Name"
        action="Rename"
        initial={preset.name}
        disabled={locked}
        onSubmit={onRename}
      />
      <NameForm
        label="Save the rail as a new preset"
        action="Save as new"
        initial=""
        disabled={locked}
        onSubmit={onSaveNew}
      />
    </section>
  );
}
