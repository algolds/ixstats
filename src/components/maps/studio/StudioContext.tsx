"use client";

import { createContext, useContext } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { StudioDiagnostics } from "~/hooks/useStudioDiagnostics";
import type { StudioFit } from "~/hooks/useStudioFit";
import type { StudioProjection } from "~/hooks/useStudioMap";
import type { WorldGenerator } from "~/hooks/useWorldGenerator";
import type { DraftLayerKey } from "~/lib/maps/world-draft-layers";
import type { StudioKey, StudioParams } from "~/lib/worldgen/studio-fields";
import type { StudioPreset } from "~/lib/worldgen/studio-presets";

/**
 * Where the world comes from. `preset`: the parameters alone. `fit`: generated around a realm's own map (its land
 * and borders stay); `realm` is null until one is chosen, and nothing is generated meanwhile.
 */
export type StudioSource =
  { kind: "preset"; preset: string } | { kind: "fit"; preset: string; realm: string | null };

/** A realm as the source picker and the Ship tab see it (a row of `atlas.realms.overview`). */
export interface StudioRealm {
  id: string;
  slug: string;
  name: string;
  /** The realm's map version now; the one a fitted world was made against is `fit.mapVersion` */
  mapVersion: number;
  /** The realm has a political layer to fit to */
  hasPolitical: boolean;
  isIxnay: boolean;
}

/** The part of the generator hook the tabs read. They never start or stop a run: that is the recipe's job. */
export type StudioGenerator = Pick<
  WorldGenerator,
  | "state"
  | "stage"
  | "pct"
  | "message"
  | "error"
  | "result"
  | "diagnostic"
  | "nationSeeds"
  | "measure"
  | "renderPng"
>;

export interface StudioContextValue {
  // The recipe
  /** The parameters now asked for (everything but the seed); a new object on every change */
  params: StudioParams;
  /** Commit a change: the world is made again from the first stage it touches */
  setParams: (patch: Partial<StudioParams>) => void;
  /** Put `keys` back to the chosen preset's values */
  resetFields: (keys: readonly StudioKey[]) => void;
  seed: number;
  setSeed: (seed: number) => void;
  reroll: () => void;
  /** Every unarchived preset in order; admins see drafts too (`hasDraft`) */
  presets: readonly StudioPreset[];
  /** The built-ins from code stand in because the presets could not be read: do not save or publish */
  presetsFallback: boolean;
  /** Slug of the preset the parameters started from */
  presetSlug: string;
  /** The values of that preset (its draft if it has one): what each control resets to */
  presetParams: StudioParams;
  /** Start from a preset: its values replace the parameters */
  pickPreset: (slug: string) => void;
  source: StudioSource;
  setSource: (source: StudioSource) => void;

  // The realms and the fit
  /** Every realm; empty while they load */
  realms: readonly StudioRealm[];
  realmsState: "loading" | "ready" | "failed";
  /** The layers a fitted world is made around; `state: "off"` for the preset source */
  fit: StudioFit;

  // The world
  generator: StudioGenerator;
  /** The world on the map is not the one the recipe now asks for (a run is on, failed, or not yet asked) */
  stale: boolean;
  /** Ask for the world again (Retry) */
  regenerate: () => void;

  // The map
  /** The Studio's own map, null until its style has loaded */
  map: MapLibreMap | null;
  /** The map's projection: the globe (the default) or flat Mercator */
  projection: StudioProjection;
  setProjection: (projection: StudioProjection) => void;
  /** Layer switches by draft layer; a missing key means shown */
  visible: Partial<Record<DraftLayerKey, boolean>>;
  setLayerVisible: (key: DraftLayerKey, visible: boolean) => void;
  diagnostics: StudioDiagnostics;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export const StudioProvider = StudioContext.Provider;

/** The Studio's state for a tab; only inside the Studio. */
export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside World Studio");
  return value;
}
