/**
 * What the map draws around its data: a realm's credit line is always shown with IxStates' own (the realm's art may be
 * licensed on condition of credit); a wiki-supplied popup title is text, never HTML; and the deck.gl transport
 * overlay is held back while the projection is the dynamic globe-to-mercator expression deck.gl throws on (the editor
 * crashed on it), and added again once the projection is plain.
 *
 * Folds: src/tests/components/maps/map-credit-line.test.tsx,
 * src/tests/components/maps/coordinates-map-embed-popup.test.tsx,
 * src/tests/components/maps/deck-transport-overlay-projection.test.tsx
 */
import { act, render, screen } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

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

import { MapKeyboardControls } from "~/components/maps/core/MapKeyboardControls";
import { DeckTransportOverlay } from "~/components/maps/overlays/DeckTransportOverlay";
import { buildPopupTitleNode } from "~/components/maps/widgets/CoordinatesMapEmbed";

describe("the map's credit block", () => {
  it("shows the realm's credit line above IxStates' own", () => {
    render(
      <MapKeyboardControls
        mapRef={{ current: null }}
        attribution="Map: Eurth community, via eurth-map by Seth Harrison"
      />
    );
    const credit = screen.getByText("Map: Eurth community, via eurth-map by Seth Harrison");
    const block = screen.getByText(/© 2026 Ixnay/);
    expect(block).toContainElement(credit);
    expect(block.textContent).toMatch(/^Map: Eurth community.*© 2026 Ixnay/);
  });
});

describe("a coordinates embed's popup", () => {
  it("renders a wiki-supplied title as text, never as HTML", () => {
    const title = "<img src=x onerror=alert(1)>";
    const node = buildPopupTitleNode(title);
    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toBe(title);
  });
});

describe("the deck.gl transport overlay and the projection", () => {
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
  const mount = (map: FakeMap) =>
    render(<DeckTransportOverlay map={map as unknown as MapLibreMap} segments={[]} visible />);

  it("holds the deck control back while the projection is the dynamic expression", () => {
    const map = new FakeMap(DYNAMIC);
    expect(() => mount(map)).not.toThrow();
    expect(map.controls).toHaveLength(0);
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
});
