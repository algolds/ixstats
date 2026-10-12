/**
 * Applying a generated world, the parts that need no React: the bundle the World tab uploads, the readable wording of
 * a refusal, and the dry-run diff in words. Pure, so it is tested apart from the panel.
 */
import type { FeatureCollection } from "geojson";
import {
  encodeCells,
  WORLD_BUNDLE_VERSION,
  type WorldBundle,
  type WorldBundleLayerName,
} from "~/lib/maps/import/world-bundle";
import { MapUploadError } from "~/lib/maps/import/upload-client";
import type { WorldSource } from "./world-controls";
import type { WorldGenResult } from "./worker/world-messages";

// The bundle

function parseLayer(result: WorldGenResult, name: WorldBundleLayerName): FeatureCollection {
  const json = result.layers[name];
  if (json === undefined) throw new Error(`The preview has no ${name} layer`);
  try {
    return JSON.parse(json) as FeatureCollection;
  } catch {
    throw new Error(`The ${name} layer of the preview could not be read`);
  }
}

/**
 * The upload for a generated world: its seed and parameters, the seven layers (no political layer when the realm's
 * own borders were kept), its nation slots (all claimable; the founder reserves some afterwards) and its cells.
 * Throws a readable reason when the draft is missing a layer or one cannot be read.
 */
export function buildWorldBundle(result: WorldGenResult, source: WorldSource): WorldBundle {
  const preset = source === "preset";
  return {
    version: WORLD_BUNDLE_VERSION,
    seed: result.seed,
    params: result.params,
    source,
    layers: {
      background: parseLayer(result, "background"),
      altitudes: parseLayer(result, "altitudes"),
      climate: parseLayer(result, "climate"),
      rivers: parseLayer(result, "rivers"),
      lakes: parseLayer(result, "lakes"),
      icecaps: parseLayer(result, "icecaps"),
      ...(preset && { political: parseLayer(result, "political") }),
    },
    slots: preset
      ? result.slots.map(({ key, name, colour, population, gdpPerCapita, areaKm2 }) => ({
          key,
          name,
          colour,
          claimable: true,
          population,
          gdpPerCapita,
          areaKm2,
        }))
      : [],
    cells: encodeCells(result.cells),
  };
}

// A refusal

/** Where the flow stopped: sending the bundle, checking it (the dry run), applying it, or rebuilding the relief. */
export type WorldFailureStage = "send" | "check" | "apply" | "relief";

export interface WorldFailure {
  stage: WorldFailureStage;
  /** The server's error code (a tRPC code, or the HTTP status of the upload read as one), when it gave one */
  code?: string;
  /** The server's own words */
  reason: string;
}

const TITLE_BY_CODE: Record<string, string> = {
  CONFLICT: "The realm can't take a world right now.",
  FORBIDDEN: "You can't change this realm's world.",
  BAD_REQUEST: "The server refused this world.",
  NOT_FOUND: "The realm or the uploaded world was not found.",
  UNAUTHORIZED: "You are signed out. Sign in again, then retry.",
  TOO_MANY_REQUESTS: "Too many requests. Wait a minute, then retry.",
};

const TITLE_BY_STAGE: Record<WorldFailureStage, string> = {
  send: "The world could not be sent.",
  check: "The world could not be checked.",
  apply: "The world could not be applied.",
  relief: "The relief could not be rebuilt.",
};

/** The HTTP statuses of the upload route, read as the tRPC codes they stand for. */
const UPLOAD_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "BAD_REQUEST",
  429: "TOO_MANY_REQUESTS",
};

/** A call that failed: a tRPC error (its `data.code`), the upload's (its HTTP status), or any other error. */
interface FailedCall {
  message: string;
  data?: { code?: string } | null;
}

/** A failed call as the flow reports it. */
export function failureOf(error: FailedCall, stage: WorldFailureStage): WorldFailure {
  const code = error instanceof MapUploadError ? UPLOAD_CODES[error.status ?? 0] : error.data?.code;
  return { stage, code, reason: error.message };
}

/** What to say about a failure: a plain title for the kind of refusal, and the server's reason under it. */
export function describeWorldFailure({ stage, code, reason }: WorldFailure) {
  return { title: (code && TITLE_BY_CODE[code]) || TITLE_BY_STAGE[stage], reason };
}

// The dry run

interface Counts {
  create: number;
  change: number;
  retire: number;
}

const joined = (parts: ReadonlyArray<readonly [number, string]>, none = "No change"): string => {
  const said = parts.filter(([count]) => count > 0).map(([count, word]) => `${count} ${word}`);
  return said.length > 0 ? said.join(", ") : none;
};

/** A layer's part of the diff: "3 new, 2 changed, 1 retired". */
export const layerChangeText = ({ create, change, retire }: Counts): string =>
  joined([
    [create, "new"],
    [change, "changed"],
    [retire, "retired"],
  ]);

/** The nations' part of the diff: new, retired, kept (held by a player or claimed) and renamed (name taken). */
export const slotChangeText = (slots: {
  create: number;
  retire: number;
  keep: number;
  renamed: number;
}): string =>
  joined([
    [slots.create, "new"],
    [slots.retire, "retired"],
    [slots.keep, "kept"],
    [slots.renamed, "renamed"],
  ]);

/** What an applied world did, for the result: the map features written and the nations made and retired. */
export const appliedText = (applied: {
  written: number;
  slots: { created: number; retired: number };
}): string =>
  joined(
    [
      [applied.written, "map features written"],
      [applied.slots.created, "nations created"],
      [applied.slots.retired, "nations retired"],
    ],
    "Nothing was written"
  );

/** A warning that work already in the realm (hand edits, earlier imports, its map) will be replaced. */
export const isReplacementWarning = (warning: string): boolean =>
  /by hand|will be replaced/i.test(warning);

export const WORLD_LAYER_LABELS: Record<WorldBundleLayerName, string> = {
  background: "Land and sea",
  altitudes: "Elevation",
  climate: "Climate",
  political: "Borders",
  rivers: "Rivers",
  lakes: "Lakes",
  icecaps: "Ice caps",
};
