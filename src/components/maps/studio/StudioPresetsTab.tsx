"use client";

import { useEffect, useRef, useState } from "react";
import { useStudioPresetActions, type PresetSummary } from "~/hooks/useStudioPresetActions";
import { isNoChange, paramsForPreset } from "~/lib/worldgen/studio-fields";
import { presetParamsOf } from "~/lib/worldgen/studio-preset-params";
import { findStudioPreset } from "~/lib/worldgen/studio-presets";
import { FALLBACK_PRESET_SLUG } from "~/lib/worldgen/world-presets";
import { useStudio } from "./StudioContext";
import { StudioArchivedPresets } from "./StudioArchivedPresets";
import { StudioPresetEditor } from "./StudioPresetEditor";
import { StudioPresetList } from "./StudioPresetList";
import { StudioPresetVersions } from "./StudioPresetVersions";

/**
 * Presets: pick one (its values load into the rail), save the rail to it as a draft or as a new preset, publish,
 * restore an older version, reset a built-in to factory, rename, reorder and archive. A preset carries no seed, so
 * none is ever sent.
 */
export function StudioPresetsTab() {
  const { presets, presetsFallback, presetSlug, presetParams, params, pickPreset, setParams } =
    useStudio();
  const actions = useStudioPresetActions();
  const [notice, setNotice] = useState<string | null>(null);
  // A preset just made is picked once the refetched list holds it, whichever of the two arrives first
  const [wanted, setWanted] = useState<string | null>(null);
  const picked = useRef<string | null>(null);
  useEffect(() => {
    if (wanted === null || picked.current === wanted) return;
    if (!presets.some((preset) => preset.slug === wanted)) return;
    picked.current = wanted;
    pickPreset(wanted);
  }, [wanted, presets, pickPreset]);

  const selected = findStudioPreset(presets, presetSlug);
  const locked = presetsFallback || actions.busy;
  /** After a write: say so if it worked (a failed one has put its reason in `actions.error`), then `then` */
  const settle = async <T,>(write: Promise<T | null>, text: string, then?: (done: T) => void) => {
    const done = await write;
    if (done === null) return;
    setNotice(text);
    then?.(done);
  };

  if (!selected) return null;
  const { slug } = selected;
  // The draft a restore or a reset wrote goes straight into the rail
  const intoRail = ({ draft }: PresetSummary) => {
    if (draft) setParams(paramsForPreset(draft.params));
  };

  return (
    <div className="space-y-4 p-3">
      <div className="space-y-1">
        <h3 className="text-headline">Presets</h3>
        <p className="text-label-secondary text-caption">
          A preset holds the rail's parameters and no seed. Choosing one puts its values in the
          rail.
        </p>
      </div>
      {presetsFallback && (
        <p role="alert" className="text-destructive text-caption">
          The saved presets could not be read, so these are the built-in ones and nothing can be
          saved.
        </p>
      )}
      {actions.error && (
        <p role="alert" className="text-destructive text-caption">
          {actions.error}
        </p>
      )}
      {notice && !actions.error && (
        <p role="status" className="text-label-secondary text-caption">
          {notice}
        </p>
      )}
      <StudioPresetList
        presets={presets}
        selected={slug}
        locked={locked}
        onSelect={pickPreset}
        onMove={(moved, by) => {
          const order = presets.map((preset) => preset.slug);
          const from = order.indexOf(moved);
          const [item] = order.splice(from, 1);
          order.splice(from + by, 0, item!);
          void settle(actions.reorder(order), "Order saved.");
        }}
      />
      <StudioPresetEditor
        preset={selected}
        dirty={!isNoChange(presetParams, params)}
        locked={locked}
        onSaveDraft={() =>
          void settle(actions.saveDraft(slug, presetParamsOf(params)), "Draft saved.")
        }
        onSaveNew={(name) =>
          void settle(
            actions.create(name, presetParamsOf(params)),
            `Saved ${name} as a new preset.`,
            (made) => setWanted(made.slug)
          )
        }
        onPublish={() => void settle(actions.publish(slug), "Published.")}
        onReset={() =>
          void settle(actions.resetToFactory(slug), "Draft reset to the factory values.", intoRail)
        }
        onRename={(name) => void settle(actions.rename(slug, name), "Renamed.")}
        onArchive={() =>
          void settle(actions.archive(slug), "Archived.", () => pickPreset(FALLBACK_PRESET_SLUG))
        }
      />
      <StudioArchivedPresets
        locked={locked}
        onRestore={(restored) => void settle(actions.archive(restored, false), "Restored.")}
      />
      <StudioPresetVersions
        key={slug}
        slug={slug}
        hasDraft={selected.hasDraft}
        locked={locked}
        onRestore={(versionId) =>
          void settle(
            actions.restore(slug, versionId),
            "Draft restored from that version.",
            intoRail
          )
        }
      />
    </div>
  );
}
