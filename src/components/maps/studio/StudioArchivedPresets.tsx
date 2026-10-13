"use client";

import { useState } from "react";
import { SwitchRow } from "~/components/maps/editor/panels/WorldControlParts";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

interface StudioArchivedPresetsProps {
  /** Writes are off: a write is under way, or the presets could not be read */
  locked: boolean;
  onRestore: (slug: string) => void;
}

/** The archived presets behind a switch, each with a Restore that brings it back as it was. */
export function StudioArchivedPresets({ locked, onRestore }: StudioArchivedPresetsProps) {
  const [shown, setShown] = useState(false);
  const query = api.atlas.presets.list.useQuery({ includeArchived: true }, { enabled: shown });
  const archived = shown ? (query.data ?? []).filter((preset) => preset.archived) : [];
  return (
    <section aria-label="Archived presets" className="space-y-2">
      <SwitchRow label="Show archived" checked={shown} onCheckedChange={setShown} />
      {shown && query.isError && (
        <p role="alert" className="text-destructive text-caption">
          The archived presets could not be read.
        </p>
      )}
      {shown && !query.isError && archived.length === 0 && !query.isLoading && (
        <p className="text-label-secondary text-caption">No preset is archived.</p>
      )}
      {archived.length > 0 && (
        <ul aria-label="Archived presets list" className="space-y-1">
          {archived.map((preset) => (
            <li key={preset.slug} className="flex items-center gap-2">
              <span className="text-footnote min-w-0 flex-1 truncate px-2">{preset.name}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={locked}
                aria-label={`Restore ${preset.name}`}
                onClick={() => onRestore(preset.slug)}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
