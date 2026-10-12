/**
 * Shared set-up of the World tab's panel tests (world-panel*.test.tsx): the answers of the mocked queries, a fake
 * generator worker the tests speak for, and the render helpers. The test file mocks `~/trpc/react` (with
 * `fake-map-import`), `useWorldPreview`, `useMapLayerData` and the apply region before importing this.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import { api } from "~/trpc/react";
import { useWorldPreview } from "~/hooks/useWorldPreview";
import { useDecodedMapLayers, useRetryMapLayers } from "~/hooks/useMapLayerData";
import { WorldApplyRegion } from "~/components/maps/editor/panels/WorldApplyRegion";
import { WorldPanel } from "~/components/maps/editor/panels/WorldPanel";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import { FACTORY_PRESETS } from "~/lib/worldgen/world-presets";
import { fakeWorldWorkers } from "~/tests/helpers/fake-world-worker";
import { resetFakeMapImport } from "~/tests/helpers/fake-map-import";

export const displayQuery = jest.mocked(api.realms.map.display.useQuery as unknown as jest.Mock);
export const statusQuery = jest.mocked(api.realms.map.worldStatus.useQuery as unknown as jest.Mock);
export const presetsQuery = jest.mocked(
  api.realms.map.worldPresets.useQuery as unknown as jest.Mock
);
export const preview = jest.mocked(useWorldPreview);
export const layersQuery = jest.mocked(useDecodedMapLayers);
export const retryLayers = jest.fn();
export const region = jest.mocked(WorldApplyRegion);

export const REALM = "r_eurth";
type Display = {
  realmId: string;
  realmSlug: string;
  isIxnay: boolean;
  canEdit: boolean;
  layerTypes: string[];
  rasterLayers: object[];
};
export const display = (over: Partial<Display> = {}) => ({
  data: {
    realmId: REALM,
    realmSlug: "eurth",
    isIxnay: false,
    canEdit: true,
    layerTypes: ["background", "political"],
    rasterLayers: [],
    ...over,
  },
});
export const OPEN = {
  data: { lockReason: null, pendingClaims: 0, approvedClaims: 0, canReviewClaims: true },
};

export const polygons = (n: number): FeatureCollection => ({
  type: "FeatureCollection",
  features: Array.from({ length: n }, () => ({
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  })),
});
let mapVersion = 0;
/**
 * The realm's mask layers as the layer queries answer. Every call is a map that changed (a new version), unless
 * `version` says it is the same map read again: the hook may hand back new objects for one and the same map.
 */
export const mapLayers = ({
  political = 2,
  background = 1,
  altitudes,
  pending = false,
  error = null,
  version = ++mapVersion,
}: {
  political?: number;
  background?: number;
  altitudes?: number;
  pending?: boolean;
  error?: Error | null;
  version?: number;
} = {}): ReturnType<typeof useDecodedMapLayers> => ({
  layers: {
    background: polygons(background),
    political: polygons(political),
    ...(altitudes !== undefined && { altitudes: polygons(altitudes) }),
  },
  packed: undefined,
  version,
  error,
  isPending: pending,
});

export let workers: ReturnType<typeof fakeWorldWorkers>["workers"];
export let factory: ReturnType<typeof fakeWorldWorkers>["factory"];

/** Run before each test: nothing stored, a fresh fake worker, every query answering as an open realm would. */
export function resetPanelTests() {
  window.localStorage.clear();
  ({ factory, workers } = fakeWorldWorkers());
  displayQuery.mockReturnValue(display());
  layersQuery.mockReturnValue(mapLayers());
  jest.mocked(useRetryMapLayers).mockReturnValue(retryLayers);
  retryLayers.mockReset();
  resetFakeMapImport();
  region.mockClear();
  statusQuery.mockReturnValue(OPEN);
  presetsQuery.mockReturnValue({ data: FACTORY_PRESETS, isError: false });
  preview.mockReset();
  preview.mockReturnValue({ active: false });
}

/** Run after each test. */
export function cleanUpPanelTests() {
  transientMapStore.setWorldDraft(null);
  jest.restoreAllMocks();
}

export const renderPanel = (props: Partial<React.ComponentProps<typeof WorldPanel>> = {}) =>
  render(<WorldPanel map={null} createWorker={factory} {...props} />);

export const lastRequest = () => workers.at(-1)!.posted.at(-1)!;
export const requestCount = () => workers.reduce((n, w) => n + w.posted.length, 0);

export async function generateFirst() {
  fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
  return lastRequest();
}

/** One key press on a slider: the keys commit when they come up. */
export const step = (name: string, key = "ArrowRight") => {
  const thumb = screen.getByRole("slider", { name });
  fireEvent.keyDown(thumb, { key });
  fireEvent.keyUp(thumb, { key });
};
