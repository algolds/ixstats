/**
 * The Studio's own map: built on the container once MapLibre has loaded, in the base style forced to Mercator (the
 * relief and diagnostic images are pinned to Mercator corners), handed out only after its style has loaded, and
 * removed on unmount, also when the unmount comes before MapLibre has loaded.
 */
import { act, render } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
jest.mock("~/lib/maps/load-maplibre", () => {
  const maps: unknown[] = [];
  class FakeMap {
    handlers = new Map<string, () => void>();
    remove = jest.fn();
    resize = jest.fn();
    constructor(readonly options: Record<string, unknown>) {
      maps.push(this);
    }
    on(event: string, handler: () => void) {
      this.handlers.set(event, handler);
    }
  }
  return { loadMaplibre: jest.fn(async () => ({ Map: FakeMap })), maps };
});

import { useStudioMap } from "~/hooks/useStudioMap";
import { loadMaplibre } from "~/lib/maps/load-maplibre";

type FakeMapInstance = {
  options: { container: HTMLElement; style: { projection: unknown }; renderWorldCopies: boolean };
  handlers: Map<string, () => void>;
  remove: jest.Mock;
  resize: jest.Mock;
};
const { maps } = jest.requireMock("~/lib/maps/load-maplibre") as { maps: FakeMapInstance[] };

class FakeResizeObserver {
  static all: FakeResizeObserver[] = [];
  constructor(private callback: () => void) {
    FakeResizeObserver.all.push(this);
  }
  observe = jest.fn();
  disconnect = jest.fn();
  fire() {
    this.callback();
  }
}

let seen: MapLibreMap | null = null;
function Host() {
  const { containerRef, map } = useStudioMap();
  seen = map;
  return <div ref={containerRef} data-testid="host" />;
}

const settle = () => act(async () => void (await Promise.resolve()));

beforeEach(() => {
  maps.length = 0;
  seen = null;
  FakeResizeObserver.all = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  jest.mocked(loadMaplibre).mockClear();
});

describe("useStudioMap", () => {
  it("builds one map on its container, in Mercator", async () => {
    const view = render(<Host />);
    await settle();
    expect(maps).toHaveLength(1);
    expect(maps[0]!.options.container).toBe(view.getByTestId("host"));
    expect(maps[0]!.options.style.projection).toEqual({ type: "mercator" });
    expect(maps[0]!.options.renderWorldCopies).toBe(false);
  });

  it("hands the map out once its style has loaded", async () => {
    render(<Host />);
    await settle();
    expect(seen).toBeNull();
    act(() => maps[0]!.handlers.get("load")!());
    expect(seen).toBe(maps[0]);
  });

  it("keeps the map the size of its container", async () => {
    render(<Host />);
    await settle();
    FakeResizeObserver.all[0]!.fire();
    expect(maps[0]!.resize).toHaveBeenCalled();
  });

  it("removes the map and stops watching on unmount", async () => {
    const view = render(<Host />);
    await settle();
    view.unmount();
    expect(maps[0]!.remove).toHaveBeenCalledTimes(1);
    expect(FakeResizeObserver.all[0]!.disconnect).toHaveBeenCalled();
  });

  it("builds no map when it is unmounted before MapLibre has loaded", async () => {
    const view = render(<Host />);
    view.unmount();
    await settle();
    expect(maps).toHaveLength(0);
  });
});
