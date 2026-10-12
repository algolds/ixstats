/**
 * Shared set-up of the World Studio shell tests: the answers of the mocked queries, a fake generator worker the tests
 * speak for, a fake map under the real draft preview, and the render helpers. The test file mocks `~/trpc/react`,
 * `~/context/auth-context`, `~/hooks/useMapLayerData`, `~/hooks/useStudioMap` and `~/components/ui/value-select`
 * (with `native-value-select`) before importing this.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import { useDecodedMapLayers, useRetryMapLayers } from "~/hooks/useMapLayerData";
import { useStudioMap } from "~/hooks/useStudioMap";
import WorldStudio from "~/components/maps/studio/WorldStudio";
import { api } from "~/trpc/react";
import { fakeDraftMap } from "~/tests/helpers/fake-draft-map";
import { fakeWorldWorkers, resultMessage } from "~/tests/helpers/fake-world-worker";

export const presetsQuery = jest.mocked(api.atlas.presets.list.useQuery as unknown as jest.Mock);
export const realmsQuery = jest.mocked(api.atlas.realms.overview.useQuery as unknown as jest.Mock);
export const layersQuery = jest.mocked(useDecodedMapLayers);
export const retryLayers = jest.fn();
export const studioMap = jest.mocked(useStudioMap);

const preset = (over: object) => ({
  description: "",
  builtIn: false,
  sortOrder: 0,
  published: null,
  draft: null,
  archived: false,
  ...over,
});

export const PRESET_ROWS = [
  preset({
    slug: "earthlike",
    name: "Earth-like",
    builtIn: true,
    published: { versionId: "v1", params: {}, publishedAt: new Date(0) },
  }),
  preset({
    slug: "ixnay",
    name: "Ixnay",
    builtIn: true,
    published: {
      versionId: "v2",
      params: { oceanPercentage: 0.771, temperatureOffset: 1.5 },
      publishedAt: new Date(0),
    },
  }),
  preset({
    slug: "badlands",
    name: "Badlands",
    published: { versionId: "v3", params: { terrainRoughness: 0.3 }, publishedAt: new Date(0) },
    draft: {
      versionId: "v4",
      params: { terrainRoughness: 0.9, plateCount: 20 },
      savedAt: new Date(0),
    },
  }),
  preset({ slug: "gone", name: "Gone", archived: true }),
];

const realm = (slug: string, name: string, missing: string[] = []) => ({
  id: `r_${slug}`,
  slug,
  name,
  status: "active",
  visibility: "public",
  mapVersion: 5,
  layers: { present: 7 - missing.length, total: 7, missing },
});
export const REALM_ROWS = [
  realm("ixnay", "Ixnay"),
  realm("eurth", "Eurth"),
  realm("shell", "Shell realm", ["political"]),
];

export const polygons = (n: number): FeatureCollection => ({
  type: "FeatureCollection",
  features: Array.from({ length: n }, () => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Point" as const, coordinates: [0, 0] },
  })),
});

export const mapLayers = (
  over: Partial<ReturnType<typeof useDecodedMapLayers>> = {}
): ReturnType<typeof useDecodedMapLayers> => ({
  layers: { background: polygons(1), political: polygons(2), altitudes: polygons(1) },
  packed: undefined,
  version: 5,
  error: null,
  isPending: false,
  ...over,
});

export let workers: ReturnType<typeof fakeWorldWorkers>["workers"];
export let factory: ReturnType<typeof fakeWorldWorkers>["factory"];
export let rig: ReturnType<typeof fakeDraftMap>;

class StubImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number
  ) {}
}

/** Run before each test: nothing stored, a fresh fake worker and map, every query answering. */
export function resetStudioTests() {
  window.localStorage.clear();
  window.innerWidth = 1280;
  Object.defineProperty(globalThis, "ImageData", { value: StubImageData, configurable: true });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:draft" });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
  ({ factory, workers } = fakeWorldWorkers());
  rig = fakeDraftMap(["fill-political", "country-name-labels"]);
  presetsQuery.mockReturnValue({ data: PRESET_ROWS, isError: false });
  realmsQuery.mockReturnValue({
    data: { realms: REALM_ROWS, partial: false, layerCounts: {} },
    isError: false,
  });
  layersQuery.mockReturnValue(mapLayers());
  jest.mocked(useRetryMapLayers).mockReturnValue(retryLayers);
  retryLayers.mockReset();
  studioMap.mockReturnValue({ containerRef: { current: null }, map: rig.map });
}

export const studioElement = (props: Partial<React.ComponentProps<typeof WorldStudio>> = {}) => (
  <WorldStudio createWorker={factory} {...props} />
);

export const renderStudio = (props: Partial<React.ComponentProps<typeof WorldStudio>> = {}) =>
  render(studioElement(props));

/** Every generate request, in order, across the workers. */
export const requests = () => workers.flatMap((worker) => worker.posted);
export const lastRequest = () => requests().at(-1)!;

/** The worker finishes the newest request. */
export function land(over: Parameters<typeof resultMessage>[1] = {}) {
  act(() => workers.at(-1)!.say(resultMessage(lastRequest().id, over)));
}

/** One key press on a slider: the keys commit when they come up. */
export function step(name: string, key = "ArrowRight") {
  const thumb = screen.getByRole("slider", { name });
  fireEvent.keyDown(thumb, { key });
  fireEvent.keyUp(thumb, { key });
}

/** Open a rail group that starts folded. */
export const openGroup = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}$`) }));
