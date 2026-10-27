"use client";

import { useEffect, useMemo, useState } from "react";
import { Import } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { RealmMapPipeline } from "~/lib/maps/realm-map-pipeline";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { ArtSection } from "./ArtSection";
import { ClimateKeySection } from "./ClimateKeySection";
import { PipelineSection } from "./fields";
import { LabelsSection } from "./LabelsSection";
import { PhysicalSection } from "./PhysicalSection";
import { PresetLoader, type PresetOption } from "./PresetLoader";
import { RastersSection } from "./RastersSection";
import { DefaultViewSection, FlagsSection, SmoothingSection } from "./SettingsSections";
import {
  artUsage,
  draftPipeline,
  stableJson,
  toDraft,
  validateDraft,
  type PipelineDraft,
} from "./pipeline-draft";

/** The browser's own prompt when the tab is closed or reloaded with unsaved edits. */
function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

const problemCount = (n: number) =>
  `${n} ${n === 1 ? "field needs" : "fields need"} fixing before you can save.`;

interface PipelineEditorProps {
  slug: string;
  realmId: string;
  /** The saved config (null: none saved yet, the form starts from `initial`). */
  saved: RealmMapPipeline | null;
  initial: RealmMapPipeline;
  source: { repo: string; ref: string } | null;
  presets: PresetOption[];
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

/** The pipeline form: preset, art, layers and settings, saved as one validated config. */
export function PipelineEditor({
  slug,
  realmId,
  saved,
  initial,
  source,
  presets,
  onSaved,
  onDirtyChange,
}: PipelineEditorProps) {
  const notify = useNotify();
  const [draft, setDraft] = useState<PipelineDraft>(() => toDraft(initial));
  const { pipeline, errors } = useMemo(() => validateDraft(draft), [draft]);
  const dirty = stableJson(draftPipeline(draft)) !== stableJson(saved);
  const artKeys = draft.art.map((row) => row.key).filter(Boolean);
  const usage = useMemo(() => artUsage(draft), [draft]);
  const errorCount = Object.keys(errors).length;

  useLeaveGuard(dirty);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = api.realms.mapPipeline.save.useMutation({
    onSuccess: () => {
      notify.success("Map pipeline saved");
      onSaved();
    },
    onError: (e) => notify.error("Could not save the map pipeline", e.message),
  });
  const change = (patch: Partial<PipelineDraft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <PipelineSection
        icon={<Import />}
        title="Preset"
        description="Fill the empty parts of this config from a community map's preset. Replace everything takes the whole preset."
      >
        <PresetLoader
          slug={slug}
          presets={presets}
          allowForce={!!saved}
          dirty={dirty}
          onLoaded={onSaved}
        />
      </PipelineSection>
      <ArtSection
        rows={draft.art}
        errors={errors}
        usage={usage}
        realmId={realmId}
        source={source}
        onChange={(art) => change({ art })}
      />
      <RastersSection
        rasters={draft.rasters}
        artKeys={artKeys}
        errors={errors}
        onChange={(rasters) => change({ rasters })}
      />
      <PhysicalSection
        physical={draft.physical}
        artKeys={artKeys}
        errors={errors}
        onChange={(physical) => change({ physical })}
      />
      <ClimateKeySection
        climate={draft.physical?.climate}
        artKeys={artKeys}
        errors={errors}
        onChange={(climate) =>
          draft.physical && change({ physical: { ...draft.physical, climate } })
        }
      />
      <LabelsSection
        labels={draft.labels}
        artKeys={artKeys}
        errors={errors}
        slug={slug}
        onChange={(labels) => change({ labels })}
      />
      <FlagsSection flags={draft.flags} onChange={(flags) => change({ flags })} />
      <DefaultViewSection
        defaultView={draft.defaultView}
        onChange={(defaultView) => change({ defaultView })}
      />
      <SmoothingSection
        coverage={draft.coverage}
        errors={errors}
        onChange={(coverage) => change({ coverage })}
      />
      <FacetMaterial className="z-sticky sticky bottom-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-footnote text-label-secondary">
          {dirty ? "Unsaved changes." : "All changes saved."}
        </span>
        {errorCount > 0 && (
          <span role="alert" className="text-destructive-ink text-footnote">
            {problemCount(errorCount)}
            {errors[""] && ` ${errors[""]}`}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => setDraft(toDraft(saved ?? initial))}
          >
            Discard changes
          </Button>
          <Button
            size="sm"
            disabled={!dirty || !pipeline || save.isPending}
            onClick={() => pipeline && save.mutate({ realm: slug, pipeline })}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </FacetMaterial>
    </div>
  );
}
