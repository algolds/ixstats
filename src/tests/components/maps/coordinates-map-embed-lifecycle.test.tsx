import { act, render } from "@testing-library/react";
import type { FeatureCollection } from "geojson";

let mockLayers: Record<string, FeatureCollection> | undefined;

jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: () => ({ layers: mockLayers }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      map: { realmForWikiArticle: { useQuery: () => ({ data: undefined, isFetched: false }) } },
    },
  },
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({ isWikiPage: false, articleSource: "ixwiki", articleTitle: undefined }),
}));
jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
jest.mock("~/lib/maps/load-maplibre", () => {
  const maps: unknown[] = [];
  class FakeMap {
    handlers = new Map<string, () => void>();
    sources = new Map<string, { setData: jest.Mock }>();
    remove = jest.fn();
    resize = jest.fn();
    constructor() {
      maps.push(this);
    }
    on(event: string, handler: () => void) {
      this.handlers.set(event, handler);
    }
    getSource(id: string) {
      return this.sources.get(id);
    }
    addSource = jest.fn((id: string) => {
      this.sources.set(id, { setData: jest.fn() });
    });
    addLayer = jest.fn();
  }
  class FakeMarker {
    setLngLat() {
      return this;
    }
    setPopup() {
      return this;
    }
    addTo() {
      return this;
    }
  }
  class FakePopup {
    setDOMContent() {
      return this;
    }
  }
  return {
    loadMaplibre: jest.fn(async () => ({ Map: FakeMap, Marker: FakeMarker, Popup: FakePopup })),
    maps,
  };
});

import { CoordinatesMapEmbed } from "~/components/maps/widgets/CoordinatesMapEmbed";

type FakeMapInstance = {
  handlers: Map<string, () => void>;
  sources: Map<string, { setData: jest.Mock }>;
  remove: jest.Mock;
  addSource: jest.Mock;
};
const { maps } = jest.requireMock("~/lib/maps/load-maplibre") as { maps: FakeMapInstance[] };

/** The browser's observers, driven by the test: one per margin an embed asks for. */
class FakeIntersectionObserver {
  static all: FakeIntersectionObserver[] = [];
  constructor(
    private callback: (entries: Array<{ isIntersecting: boolean }>) => void,
    readonly options: { rootMargin: string }
  ) {
    FakeIntersectionObserver.all.push(this);
  }
  observe = jest.fn();
  disconnect = jest.fn();
  report(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}
const observer = (rootMargin: string) =>
  FakeIntersectionObserver.all.find((o) => o.options.rootMargin === rootMargin)!;
/** The observer that decides when the embed builds its map, and the one that decides when it lets it go. */
const near = () => observer("200px");
const keep = () => observer("100% 0px");

const political = (id: string): FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { _id: id }, geometry: { type: "Point", coordinates: [0, 0] } },
  ],
});

async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(60); // the embed waits for its container's layout
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

/** Scroll the embed into range, let its map build, and finish loading it. */
async function buildMap() {
  act(() => near().report(true));
  await flush();
  act(() => maps[maps.length - 1]!.handlers.get("load")?.());
}

// A new element each time: React skips a re-render for the same element
const embed = () => <CoordinatesMapEmbed lat={10} lng={20} />;

beforeEach(() => {
  jest.useFakeTimers();
  maps.length = 0;
  FakeIntersectionObserver.all = [];
  mockLayers = undefined;
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: FakeIntersectionObserver,
    configurable: true,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: class {
      observe() {}
      disconnect() {}
    },
    configurable: true,
  });
});
afterEach(() => jest.useRealTimers());

describe("CoordinatesMapEmbed map lifecycle", () => {
  it("builds no map until it is near the viewport", async () => {
    render(embed());
    await flush();
    expect(maps).toHaveLength(0);

    await buildMap();
    expect(maps).toHaveLength(1);
  });

  it("puts the data in with setData when it changes, and builds no new map", async () => {
    const view = render(embed());
    await buildMap();

    mockLayers = { political: political("a") };
    view.rerender(embed());
    expect(maps).toHaveLength(1);
    expect(maps[0]!.addSource).toHaveBeenCalledTimes(1);

    const changed = political("b");
    mockLayers = { political: changed };
    view.rerender(embed());

    expect(maps).toHaveLength(1);
    expect(maps[0]!.remove).not.toHaveBeenCalled();
    expect(maps[0]!.addSource).toHaveBeenCalledTimes(1);
    expect(maps[0]!.sources.get("source-world-political")!.setData).toHaveBeenCalledWith(changed);
  });

  it("draws data that arrived before its map was ready", async () => {
    mockLayers = { political: political("a") };
    render(embed());
    await buildMap();

    expect(maps[0]!.addSource).toHaveBeenCalledWith(
      "source-world-political",
      expect.objectContaining({ type: "geojson" })
    );
  });

  it("releases its map when it is more than one viewport away", async () => {
    const view = render(embed());
    await buildMap();

    act(() => keep().report(false));

    expect(maps[0]!.remove).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(maps[0]!.remove).toHaveBeenCalledTimes(1);
  });

  it("keeps its map while it is within a viewport, however far from the build margin", async () => {
    render(embed());
    await buildMap();

    act(() => near().report(false));

    expect(maps[0]!.remove).not.toHaveBeenCalled();
  });

  it("builds a map again, with its data, when it scrolls back", async () => {
    mockLayers = { political: political("a") };
    render(embed());
    await buildMap();
    act(() => keep().report(false));

    await buildMap();

    expect(maps).toHaveLength(2);
    expect(maps[1]!.remove).not.toHaveBeenCalled();
    expect(maps[1]!.addSource).toHaveBeenCalledTimes(1);
  });

  it("removes its map when it unmounts", async () => {
    const view = render(embed());
    await buildMap();

    view.unmount();

    expect(maps[0]!.remove).toHaveBeenCalledTimes(1);
  });

  it("builds no map when it unmounts while MapLibre is still loading", async () => {
    const view = render(embed());
    act(() => near().report(true));
    act(() => {
      jest.advanceTimersByTime(60);
    });

    view.unmount();
    await flush();

    expect(maps).toHaveLength(0);
  });
});
