"use client";

import { useCallback, useState } from "react";
import type { WorldPresetParams } from "~/lib/worldgen/v2/types";
import { api, type RouterOutputs } from "~/trpc/react";

export type PresetSummary = RouterOutputs["atlas"]["presets"]["saveDraft"];

export interface StudioPresetActions {
  /** A write is under way */
  busy: boolean;
  /** Why the last write failed, in the server's words; cleared by the next write */
  error: string | null;
  /** Each returns the preset as it is now, or null when the write failed (see `error`) */
  saveDraft: (slug: string, params: WorldPresetParams) => Promise<PresetSummary | null>;
  create: (name: string, params: WorldPresetParams) => Promise<PresetSummary | null>;
  publish: (slug: string) => Promise<PresetSummary | null>;
  restore: (slug: string, versionId: string) => Promise<PresetSummary | null>;
  resetToFactory: (slug: string) => Promise<PresetSummary | null>;
  rename: (slug: string, name: string) => Promise<PresetSummary | null>;
  reorder: (slugs: string[]) => Promise<PresetSummary[] | null>;
  archive: (slug: string) => Promise<PresetSummary | null>;
}

/**
 * The preset writes of `atlas.presets.*`, each followed by a fresh list (the Studio's `presets` come from it). A write
 * that fails keeps its reason in `error`; none of them throws. Params passed in must already be free of a seed.
 */
export function useStudioPresetActions(): StudioPresetActions {
  const utils = api.useUtils();
  const presets = api.atlas.presets;
  const saveDraft = presets.saveDraft.useMutation();
  const create = presets.create.useMutation();
  const publish = presets.publish.useMutation();
  const restore = presets.restore.useMutation();
  const resetToFactory = presets.resetToFactory.useMutation();
  const rename = presets.rename.useMutation();
  const reorder = presets.reorder.useMutation();
  const archive = presets.archive.useMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T>(write: () => Promise<T>): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        const done = await write();
        await Promise.all([
          utils.atlas.presets.list.invalidate(),
          utils.atlas.presets.versions.invalidate(),
        ]);
        return done;
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "The preset could not be saved");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [utils]
  );

  return {
    busy,
    error,
    saveDraft: (slug, params) => run(() => saveDraft.mutateAsync({ slug, params })),
    create: (name, params) => run(() => create.mutateAsync({ name, params })),
    publish: (slug) => run(() => publish.mutateAsync({ slug })),
    restore: (slug, versionId) => run(() => restore.mutateAsync({ slug, versionId })),
    resetToFactory: (slug) => run(() => resetToFactory.mutateAsync({ slug })),
    rename: (slug, name) => run(() => rename.mutateAsync({ slug, name })),
    reorder: (slugs) => run(() => reorder.mutateAsync({ slugs })),
    archive: (slug) => run(() => archive.mutateAsync({ slug })),
  };
}
