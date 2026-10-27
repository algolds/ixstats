/**
 * World presets as the World tab and the Studio know them: a slug, a name and a recipe without a seed. The presets
 * live in the database (`WorldPreset`); `WORLD_PRESETS` stays in code as the factory defaults they are seeded from,
 * what "Reset to factory" goes back to, and what the World tab falls back to while the database cannot be read.
 */

import { WORLD_PRESETS, type WorldPreset } from "./v2/config";
import type { WorldPresetParams } from "./v2/types";

export interface WorldPresetOption {
  slug: string;
  name: string;
  params: WorldPresetParams;
}

/** The preset a stored recipe falls back to when its preset is gone, archived or unpublished. */
export const FALLBACK_PRESET_SLUG: WorldPreset = "earthlike";

const FACTORY_COPY = {
  earthlike: {
    name: "Earth-like",
    description: "The generator's defaults: about 70% ocean and a mix of continents and islands.",
  },
  ixnay: {
    name: "Ixnay",
    description: "Shaped like Ixnay: six flat continents with many islands, warm and wet.",
  },
  eurth: {
    name: "Eurth",
    description: "Shaped like Eurth: two large continents, rugged land and a polar continent.",
  },
} satisfies Record<WorldPreset, { name: string; description: string }>;

export interface FactoryPreset extends WorldPresetOption {
  description: string;
}

/** The built-in presets, in their order, with the recipes `WORLD_PRESETS` holds. */
export const FACTORY_PRESETS: readonly FactoryPreset[] = (
  Object.keys(WORLD_PRESETS) as WorldPreset[]
).map((slug) => ({ slug, ...FACTORY_COPY[slug], params: WORLD_PRESETS[slug] }));

/** The preset with `slug`; the fallback preset when there is none, and the factory one when even that is missing. */
export function resolvePreset(
  presets: readonly WorldPresetOption[],
  slug: string
): WorldPresetOption {
  return (
    presets.find((preset) => preset.slug === slug) ??
    presets.find((preset) => preset.slug === FALLBACK_PRESET_SLUG) ?? {
      slug: FALLBACK_PRESET_SLUG,
      name: FACTORY_COPY[FALLBACK_PRESET_SLUG].name,
      params: WORLD_PRESETS[FALLBACK_PRESET_SLUG],
    }
  );
}
