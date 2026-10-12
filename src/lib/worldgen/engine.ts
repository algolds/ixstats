/**
 * World Generation Engine — Orchestrator (Delegates directly to UPG v2)
 *
 * Output: 7-layer GeoJSON compatible with IxWorldMap renderer.
 */

import type { WorldGenParams, GeneratedWorld, ProgressCallback } from "./types";
import { generateWorld as generateWorldV2 } from "./v2";

/**
 * Generate a complete world using the Unified Physical Geography Engine (v2).
 * Parameters are merged with the v2 defaults; spread a `WORLD_PRESETS` entry to start from a realm.
 *
 * @param userParams Generation parameters
 * @param onProgress Optional progress callback for UI
 * @returns Generated world with 7-layer GeoJSON output
 */
export function generateWorld(
  userParams: Partial<WorldGenParams>,
  onProgress?: ProgressCallback
): GeneratedWorld {
  return generateWorldV2(userParams, onProgress) as unknown as GeneratedWorld;
}
