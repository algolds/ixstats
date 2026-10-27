/**
 * The presets World Studio offers: every unarchived preset, drafts included, each with the recipe the Studio starts
 * from (the draft if the preset has one, else its published version). Founders see only published ones; this is the
 * admin's view of `atlas.presets.list`.
 */

import { FACTORY_PRESETS, FALLBACK_PRESET_SLUG } from "./world-presets";
import type { WorldPresetParams } from "./v2/types";

/** What of a preset row the Studio reads (`atlas.presets.list` fits). */
export interface PresetRow {
  slug: string;
  name: string;
  builtIn: boolean;
  archived: boolean;
  published: { params: WorldPresetParams } | null;
  draft: { params: WorldPresetParams } | null;
}

export interface StudioPreset {
  slug: string;
  name: string;
  builtIn: boolean;
  /** The preset has an unpublished draft: the Studio starts from it, and founders do not see it yet */
  hasDraft: boolean;
  /** Founders can pick it: it has a published version */
  published: boolean;
  /** The recipe the Studio starts from */
  params: WorldPresetParams;
}

export function studioPresets(rows: readonly PresetRow[]): StudioPreset[] {
  return rows
    .filter((row) => !row.archived)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      builtIn: row.builtIn,
      hasDraft: row.draft !== null,
      published: row.published !== null,
      params: row.draft?.params ?? row.published?.params ?? {},
    }));
}

/** The three built-ins from code, for when the presets cannot be read. */
export const FACTORY_STUDIO_PRESETS: readonly StudioPreset[] = FACTORY_PRESETS.map((preset) => ({
  slug: preset.slug,
  name: preset.name,
  builtIn: true,
  hasDraft: false,
  published: true,
  params: preset.params,
}));

/** The preset with `slug`, else Earth-like, else the first there is. */
export function findStudioPreset(
  presets: readonly StudioPreset[],
  slug: string
): StudioPreset | undefined {
  return (
    presets.find((preset) => preset.slug === slug) ??
    presets.find((preset) => preset.slug === FALLBACK_PRESET_SLUG) ??
    presets[0]
  );
}
