import { act, render } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { DeckTransportOverlay } from "~/components/maps/overlays/DeckTransportOverlay";

// deck.gl's MapboxOverlay reads the map's projection spec on add, on every setProps and on every
// render, and throws on anything but "globe"/"mercator". This stand-in keeps that behaviour.
jest.mock("@deck.gl/mapbox", () => {
  type Spec = { type?: string | Array<string | number | string[]> };
  type ProjectionMap = { getProjection(): Spec | undefined };
  const assertSupported = (map: ProjectionMap | undefined) => {
    const type = map?.getProjection()?.type;
    if (type !== undefined && type !== "globe" && type !== "mercator") {
      throw new Error("Unsupported projection");
    }
  };
  class MapboxOverlay {
    private map: ProjectionMap | undefined;
    onAdd(map: ProjectionMap) {
      assertSupported(map);
      this.map = map;
      return document.createElement("div");
    }
    setProps() {
      assertSupported(this.map);
    }
    onRemove() {
      this.map = undefined;
    }
    finalize() {}
    getDefaultPosition() {
      return "top-left";
    }
  }
  return { MapboxOverlay };
});
jest.mock("@deck.gl/layers", () => ({ ArcLayer: class {}, ColumnLayer: class {} }));
jest.mock("@deck.gl/geo-layers", () => ({ TripsLayer: class {} }));

type ProjectionType = string | Array<string | number | string[]>;

const DYNAMIC: ProjectionType = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2.5,
  "globe",
  5.5,
  "mercator",
];

interface FakeControl {
  onAdd(map: FakeMap): HTMLElement;
  onRemove(map: FakeMap): void;
}

/** The slice of a MapLibre map the overlay touches, with `render` emitted by the test. */
class FakeMap {
  controls: FakeControl[] = [];
  private listeners = new Map<string, Set<() => void>>();

  constructor(public projectionType: ProjectionType | undefined) {}

  getProjection() {
    return this.projectionType === undefined ? undefined : { type: this.projectionType };
  }
  getZoom() {
    return 6;
  }
  on(event: string, handler: () => void) {
    const set = this.listeners.get(event) ?? new Set<() => void>();
    set.add(handler);
    this.listeners.set(event, set);
  }
  off(event: string, handler: () => void) {
    this.listeners.get(event)?.delete(handler);
  }
  emit(event: string) {
    for (const handler of [...(this.listeners.get(event) ?? [])]) handler();
  }
  addControl(control: FakeControl) {
    control.onAdd(this);
    this.controls.push(control);
  }
  removeControl(control: FakeControl) {
    this.controls = this.controls.filter((c) => c !== control);
    control.onRemove(this);
  }
}

const asMap = (map: FakeMap): MapLibreMap => map as never;

function mount(map: FakeMap, visible = true) {
  return render(<DeckTransportOverlay map={asMap(map)} segments={[]} visible={visible} />);
}

describe("DeckTransportOverlay projection guard", () => {
  it("holds the deck control back while the projection is the dynamic expression", () => {
    const map = new FakeMap(DYNAMIC);

    expect(() => mount(map)).not.toThrow();

    expect(map.controls).toHaveLength(0);
  });

  it("adds the deck control as soon as the projection is locked to mercator", () => {
    const map = new FakeMap(DYNAMIC);
    mount(map);

    map.projectionType = "mercator";
    act(() => map.emit("render"));

    expect(map.controls).toHaveLength(1);
    act(() => map.emit("render"));
    expect(map.controls).toHaveLength(1);
  });

  it("adds the deck control immediately on a plain mercator or globe map", () => {
    const mercator = new FakeMap("mercator");
    const globe = new FakeMap("globe");
    mount(mercator);
    mount(globe);

    expect(mercator.controls).toHaveLength(1);
    expect(globe.controls).toHaveLength(1);
  });

  it("adds the deck control on a map whose style has no projection yet", () => {
    const map = new FakeMap(undefined);
    mount(map);

    expect(map.controls).toHaveLength(1);
  });

  it("removes the deck control when the projection turns dynamic and re-adds it when plain again", () => {
    const map = new FakeMap("mercator");
    mount(map);
    const first = map.controls[0];

    map.projectionType = DYNAMIC;
    expect(() => act(() => map.emit("render"))).not.toThrow();
    expect(map.controls).toHaveLength(0);

    map.projectionType = "mercator";
    act(() => map.emit("render"));
    expect(map.controls).toHaveLength(1);
    expect(map.controls[0]).not.toBe(first);
  });

  it("does not push layers into deck between a projection change and the next render", () => {
    const map = new FakeMap("mercator");
    const { rerender } = mount(map);

    map.projectionType = DYNAMIC;

    expect(() =>
      rerender(<DeckTransportOverlay map={asMap(map)} segments={[]} visible={false} />)
    ).not.toThrow();
  });

  it("removes the deck control on unmount", () => {
    const map = new FakeMap("mercator");
    const { unmount } = mount(map);

    unmount();

    expect(map.controls).toHaveLength(0);
  });
});
