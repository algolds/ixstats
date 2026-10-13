/**
 * Shared set-up of the inspector tab tests (Calibration, Presets, Ship): a `StudioContext` value built from fakes, so
 * a tab is rendered alone with exactly the state a test gives it, and the fake world generator (`measure`, `renderPng`)
 * the tabs call. The test files mock `~/trpc/react` and `~/components/ui/value-select` (with `native-value-select`).
 */
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  StudioProvider,
  type StudioContextValue,
  type StudioRealm,
} from "~/components/maps/studio/StudioContext";
import { paramsForPreset } from "~/lib/worldgen/studio-fields";
import { FACTORY_STUDIO_PRESETS } from "~/lib/worldgen/studio-presets";
import type { WorldMeasures } from "~/lib/worldgen/measure-world";
import { worldResult } from "~/tests/helpers/fake-world-worker";

export const REALMS: readonly StudioRealm[] = [
  { id: "r_ixnay", slug: "ixnay", name: "Ixnay", mapVersion: 5, hasPolitical: true, isIxnay: true },
  {
    id: "r_eurth",
    slug: "eurth",
    name: "Eurth",
    mapVersion: 3,
    hasPolitical: true,
    isIxnay: false,
  },
  {
    id: "r_shell",
    slug: "shell",
    name: "Shell",
    mapVersion: 1,
    hasPolitical: true,
    isIxnay: false,
  },
];

export const MEASURES: WorldMeasures = {
  landShare: 0.312,
  hypsometry: [0.4, 0.3, 0.15, 0.08, 0.04, 0.02, 0.008, 0.002, 0],
  climate: { A: 0.2, B: 0.1, C: 0.3, D: 0.25, E: 0.1, F: 0.03, H: 0.02 },
  unclassifiedShare: 0,
  nations: { count: 130, medianKm2: 706_665, p90Km2: 2_247_021 },
  coastlineKm: 760_179,
};

export const IXNAY_MEASURES: WorldMeasures = {
  landShare: 0.2203,
  hypsometry: [0.4711, 0.2552, 0.1553, 0.0885, 0.0196, 0.0075, 0.0022, 0.0006, 0],
  climate: { A: 0.2539, B: 0.1943, C: 0.3052, D: 0.2145, E: 0.02, F: 0.002, H: 0.0101 },
  unclassifiedShare: 0,
  nations: { count: 183, medianKm2: 272_569, p90Km2: 1_443_534 },
  coastlineKm: 668_684,
};

const noop = () => {};

/** A context value with a ready world and jest.fn()s for everything a tab calls; `over` replaces any part. */
export function studioValue(over: Partial<StudioContextValue> = {}): StudioContextValue {
  const earthlike = FACTORY_STUDIO_PRESETS.find((preset) => preset.slug === "earthlike")!;
  const params = paramsForPreset(earthlike.params);
  return {
    params,
    setParams: jest.fn(),
    resetFields: jest.fn(),
    seed: 7,
    setSeed: jest.fn(),
    reroll: jest.fn(),
    presets: FACTORY_STUDIO_PRESETS,
    presetsFallback: false,
    presetSlug: "earthlike",
    presetParams: params,
    pickPreset: jest.fn(),
    source: { kind: "preset", preset: "earthlike" },
    setSource: jest.fn(),
    realms: REALMS,
    realmsState: "ready",
    fit: {
      state: "off",
      landMaskLayers: {},
      mapVersion: undefined,
      maskKey: undefined,
      retry: noop,
    },
    generator: {
      state: "ready",
      stage: null,
      pct: 0,
      message: "",
      error: null,
      result: worldResult(),
      diagnostic: jest.fn(),
      nationSeeds: jest.fn(),
      measure: jest.fn().mockResolvedValue(MEASURES),
      renderPng: jest.fn(),
    },
    stale: false,
    regenerate: jest.fn(),
    map: null,
    projection: "globe",
    setProjection: jest.fn(),
    visible: {},
    setLayerVisible: jest.fn(),
    diagnostics: {
      kind: null,
      setKind: jest.fn(),
      image: null,
      seedsOn: false,
      setSeedsOn: jest.fn(),
      seeds: null,
      error: null,
    },
    ...over,
  };
}

/** Render `tab` inside a Studio context; `rerender` takes a new value. */
export function renderTab(tab: ReactElement, value: StudioContextValue = studioValue()) {
  const view = render(<StudioProvider value={value}>{tab}</StudioProvider>);
  return {
    value,
    ...view,
    rerenderWith: (next: StudioContextValue) =>
      view.rerender(<StudioProvider value={next}>{tab}</StudioProvider>),
  };
}
