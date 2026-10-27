/** What the Presets tab saves: the rail's parameters as a preset's, which never carry a seed. */

import { cloneParams, type StudioParams } from "./studio-fields";
import type { WorldPresetParams } from "./v2/types";

/** A copy of `params` for a preset: every parameter but the seed (presets are recipes, not worlds). */
export function presetParamsOf(params: StudioParams): WorldPresetParams {
  const copy: StudioParams & { seed?: number } = cloneParams(params);
  delete copy.seed;
  return copy;
}
