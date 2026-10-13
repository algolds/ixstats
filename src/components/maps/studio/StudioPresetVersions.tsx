"use client";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { StudioConfirm } from "./StudioConfirm";

interface StudioPresetVersionsProps {
  slug: string;
  /** The preset has a draft, which Restore replaces */
  hasDraft: boolean;
  locked: boolean;
  onRestore: (versionId: string) => void;
}

const WHEN = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** Every published version of the preset, newest first, each with Restore (a new draft from it). */
export function StudioPresetVersions({
  slug,
  hasDraft,
  locked,
  onRestore,
}: StudioPresetVersionsProps) {
  const versions = api.atlas.presets.versions.useQuery({ slug }, { retry: 1 });
  return (
    <section aria-label="Versions" className="space-y-2">
      <h4 className="text-footnote font-medium">Versions</h4>
      {versions.isError && (
        <p role="alert" className="text-destructive text-caption">
          The versions could not be read.
        </p>
      )}
      {versions.data?.length === 0 && (
        <p className="text-label-secondary text-caption">Nothing has been published yet.</p>
      )}
      <ul className="space-y-2">
        {versions.data?.map((version) => (
          <li key={version.versionId} className="flex items-center gap-2">
            <div className="text-caption min-w-0 flex-1">
              <p className="tabular-nums">
                {version.publishedAt ? WHEN.format(version.publishedAt) : "Not published"}
              </p>
              {version.note && <p className="text-label-secondary truncate">{version.note}</p>}
            </div>
            {version.current && <Badge variant="success">Current</Badge>}
            {hasDraft ? (
              <StudioConfirm
                label="Restore"
                title="Restore this version?"
                description="This starts a new draft from the version and replaces the draft now saved."
                disabled={locked}
                onConfirm={() => onRestore(version.versionId)}
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={locked}
                onClick={() => onRestore(version.versionId)}
              >
                Restore
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
