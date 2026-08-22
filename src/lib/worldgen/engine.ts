/**
 * World Generation Engine — Orchestrator (Delegates directly to UPG v2)
 *
 * Output: 7-layer GeoJSON compatible with IxWorldMap renderer.
 */

import type {
  WorldGenParams,
  GeneratedWorld,
  ProgressCallback,
} from "./types";
import { DEFAULT_PARAMS } from "./types";
import { generateWorld as generateWorldV2 } from "./v2";

/**
 * Generate a complete world using the Unified Physical Geography Engine (v2).
 *
 * @param userParams Generation parameters (merged with defaults)
 * @param onProgress Optional progress callback for UI
 * @returns Generated world with 7-layer GeoJSON output
 */
export function generateWorld(
  userParams: Partial<WorldGenParams>,
  onProgress?: ProgressCallback
): GeneratedWorld {
  const params: WorldGenParams = { ...DEFAULT_PARAMS, ...userParams };
  const v2World = generateWorldV2(params, onProgress as any);
  return v2World as unknown as GeneratedWorld;
}

