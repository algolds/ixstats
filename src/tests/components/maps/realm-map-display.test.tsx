/**
 * A realm's map display: its credit line, the political legend with unclaimed nations hatched, the hatch and
 * base-image layers on the map, a scale bar measured on the realm's planet radius, the cursor coordinates and
 * the default view. MapLibre is replaced by small fakes that record what the code asks of it.
 */
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { RealmMapAttribution } from "~/components/maps/core/RealmMapAttribution";
import { legendNations, RealmMapLegend } from "~/components/maps/core/RealmMapLegend";
import { RealmMapScale } from "~/components/maps/core/RealmMapScale";
import { useRealmDefaultView } from "~/components/maps/core/RealmMapKey";
import {
  BASE_IMAGE_COORDINATES,
  BASE_IMAGE_LAYER_ID,
  BASE_IMAGE_SOURCE_ID,
  hatchPattern,
  syncBaseImage,
  syncUnclaimedHatch,
  UNCLAIMED_LAYER_ID,
  UNCLAIMED_PATTERN_ID,
} from "~/components/maps/core/utils/realm-map-layers";
import {
  formatLngLat,
  measureScaleSpanKm,
  roundScaleDistance,
  scaleBarFor,
} from "~/components/maps/core/utils/realm-scale";
import { EARTH_RADIUS_KM } from "~/lib/maps/planet";

function region(countryId: string, name: string, color: string): FeatureCollection["features"][0] {
  return {
    type: "Feature",
    properties: { _countryId: countryId, _displayName: name, _fillColor: color },
    geometry: { type: "Point", coordinates: [0, 0] },
  };
}

const POLITICAL: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    region("c_gal", "Gallambria", "#aa3355"),
    region("c_gal", "Gallambria", "#aa3355"), // a second region of the same nation
    region("c_ost", "Ostia", "#3355aa"),
  ],
};

describe("credit line", () => {
  it("shows the realm's attribution, and nothing without one", () => {
    const { rerender } = render(<RealmMapAttribution text="Map by the Eurth community" />);
    expect(screen.getByTestId("realm-map-attribution")).toHaveTextContent(
      "Map by the Eurth community"
    );
    rerender(<RealmMapAttribution text={null} />);
    expect(screen.queryByTestId("realm-map-attribution")).toBeNull();
  });
});

describe("political legend", () => {
  it("lists each nation once, by name, with its colour and whether it is claimed", () => {
    expect(legendNations(POLITICAL, ["c_ost"])).toEqual([
      { id: "c_gal", name: "Gallambria", color: "#aa3355", unclaimed: false },
      { id: "c_ost", name: "Ostia", color: "#3355aa", unclaimed: true },
    ]);
  });

  it("is collapsed until opened, then shows nations by colour and the unclaimed key", () => {
    render(<RealmMapLegend political={POLITICAL} unclaimedCountryIds={["c_ost"]} />);
    const toggle = screen.getByRole("button", { name: /Nations \(2\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Nations by colour" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Gallambria", "Ostia(unclaimed)"]);
    expect(screen.getByText("Unclaimed nation (no player yet)")).toBeInTheDocument();

    const swatch = (li: HTMLElement) => li.querySelector("span[aria-hidden]") as HTMLElement;
    expect(swatch(items[0]!).style.backgroundImage).toBe("");
    expect(swatch(items[1]!).style.backgroundImage).toContain("repeating-linear-gradient");
  });

  it("renders nothing for a map with no nations", () => {
    const { container } = render(
      <RealmMapLegend political={{ type: "FeatureCollection", features: [] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

/** A fake map: records added sources, layers, images and filters; knows the political layers exist. */
function fakeStyleMap(existing: string[] = ["fill-political", "stroke-political"]) {
  const layers = new Map<string, Record<string, unknown>>(existing.map((id) => [id, { id }]));
  const order = [...existing];
  const sources = new Map<string, Record<string, unknown>>([["source-political", {}]]);
  const images = new Map<string, unknown>();
  const calls = {
    addLayer: jest.fn((spec: { id: string }, before?: string) => {
      layers.set(spec.id, spec);
      order.splice(before ? order.indexOf(before) : order.length, 0, spec.id);
    }),
    removeLayer: jest.fn((id: string) => {
      layers.delete(id);
      order.splice(order.indexOf(id), 1);
    }),
    setFilter: jest.fn(),
    setLayoutProperty: jest.fn(),
  };
  const map = {
    ...calls,
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: jest.fn((id: string, spec: Record<string, unknown>) => sources.set(id, spec)),
    removeSource: jest.fn((id: string) => sources.delete(id)),
    hasImage: (id: string) => images.has(id),
    addImage: jest.fn((id: string, image: unknown) => images.set(id, image)),
    getStyle: () => ({ layers: order.map((id) => ({ id })) }),
  };
  return { map: map as unknown as MapLibreMap, fake: map, order, sources };
}

describe("unclaimed nations on the map", () => {
  it("hatches the unclaimed nations' regions over their fill, under the borders", () => {
    const { map, fake, order } = fakeStyleMap();
    syncUnclaimedHatch(map, ["c_ost", "c_new"], true);

    expect(fake.addImage).toHaveBeenCalledWith(UNCLAIMED_PATTERN_ID, hatchPattern());
    const [spec, before] = fake.addLayer.mock.calls[0]!;
    expect(spec).toMatchObject({
      id: UNCLAIMED_LAYER_ID,
      type: "fill",
      source: "source-political",
      paint: { "fill-pattern": UNCLAIMED_PATTERN_ID },
      filter: ["in", ["get", "_countryId"], ["literal", ["c_ost", "c_new"]]],
    });
    expect(before).toBe("stroke-political");
    expect(order).toEqual(["fill-political", UNCLAIMED_LAYER_ID, "stroke-political"]);
    expect(fake.setLayoutProperty).toHaveBeenCalledWith(
      UNCLAIMED_LAYER_ID,
      "visibility",
      "visible"
    );
  });

  it("follows the claims and the political layer's visibility, and leaves when all are claimed", () => {
    const { map, fake } = fakeStyleMap();
    syncUnclaimedHatch(map, ["c_ost"], true);
    syncUnclaimedHatch(map, ["c_new"], false);
    expect(fake.setFilter).toHaveBeenCalledWith(UNCLAIMED_LAYER_ID, [
      "in",
      ["get", "_countryId"],
      ["literal", ["c_new"]],
    ]);
    expect(fake.setLayoutProperty).toHaveBeenLastCalledWith(
      UNCLAIMED_LAYER_ID,
      "visibility",
      "none"
    );
    syncUnclaimedHatch(map, [], true);
    expect(fake.removeLayer).toHaveBeenCalledWith(UNCLAIMED_LAYER_ID);
  });

  it("the hatch is translucent diagonal stripes", () => {
    const { width, height, data } = hatchPattern(8);
    expect([width, height, data.length]).toEqual([8, 8, 8 * 8 * 4]);
    const alpha = (x: number, y: number) => data[(y * 8 + x) * 4 + 3];
    expect(alpha(0, 0)).toBeGreaterThan(0);
    expect(alpha(4, 0)).toBe(0);
    expect(alpha(7, 1)).toBeGreaterThan(0);
  });
});

describe("base image", () => {
  it("is a full-globe image source under the map's data layers, credited", () => {
    const { map, fake, order, sources } = fakeStyleMap([
      "background",
      "fill-climate",
      "fill-political",
    ]);
    syncBaseImage(map, "https://example.org/eurth.png", "Eurth community");

    expect(sources.get(BASE_IMAGE_SOURCE_ID)).toEqual({
      type: "image",
      url: "https://example.org/eurth.png",
      coordinates: [
        [-180, 85],
        [180, 85],
        [180, -85],
        [-180, -85],
      ],
      attribution: "Eurth community",
    });
    expect(BASE_IMAGE_COORDINATES[0]).toEqual([-180, 85]);
    expect(fake.addLayer.mock.calls[0]![0]).toMatchObject({
      type: "raster",
      source: BASE_IMAGE_SOURCE_ID,
    });
    expect(order).toEqual(["background", BASE_IMAGE_LAYER_ID, "fill-climate", "fill-political"]);
  });

  it("is removed when the realm has none", () => {
    const { map, fake, sources } = fakeStyleMap();
    syncBaseImage(map, "https://example.org/eurth.png");
    syncBaseImage(map, null);
    expect(fake.removeLayer).toHaveBeenCalledWith(BASE_IMAGE_LAYER_ID);
    expect(sources.has(BASE_IMAGE_SOURCE_ID)).toBe(false);
  });
});

/** A flat fake projection: 1 pixel is 0.1° of longitude on the equator. */
function fakeProjectionMap() {
  const handlers = new Map<string, (e?: unknown) => void>();
  const map = {
    getContainer: () => ({ clientWidth: 800, clientHeight: 600 }) as HTMLElement,
    unproject: ([x]: [number, number]) => ({ lng: x / 10, lat: 0 }),
    on: jest.fn((event: string, fn: (e?: unknown) => void) => handlers.set(event, fn)),
    off: jest.fn((event: string) => handlers.delete(event)),
  };
  return { map: map as unknown as MapLibreMap, handlers };
}

describe("scale bar on the realm's planet", () => {
  it("rounds to 1, 2, 3 or 5 times a power of ten", () => {
    expect([7, 45, 260, 0.4].map(roundScaleDistance)).toEqual([5, 30, 200, 0.3]);
  });

  it("measures the span with the realm's radius, not Earth's", () => {
    const { map } = fakeProjectionMap();
    const earth = measureScaleSpanKm(map as never, 100, EARTH_RADIUS_KM);
    const small = measureScaleSpanKm(map as never, 100, EARTH_RADIUS_KM / 2);
    // 100 px is 10° of the equator: 2πr × 10/360
    expect(earth).toBeCloseTo((2 * Math.PI * EARTH_RADIUS_KM * 10) / 360, 3);
    expect(small).toBeCloseTo(earth / 2, 6);
  });

  it("draws a round distance and a bar that fits it", () => {
    expect(scaleBarFor(1112, 100)).toEqual({ widthPx: 90, label: "1,000 km" });
    expect(scaleBarFor(0.45, 100)).toEqual({ widthPx: 67, label: "300 m" });
    expect(scaleBarFor(0, 100)).toBeNull();
  });

  it("renders the scale for the realm's radius and the cursor's coordinates", () => {
    const frames: FrameRequestCallback[] = [];
    const raf = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => frames.push(cb));
    const flush = () => frames.splice(0).forEach((cb) => cb(0));
    const { map, handlers } = fakeProjectionMap();
    const { rerender } = render(<RealmMapScale map={map} radiusKm={EARTH_RADIUS_KM} />);
    expect(screen.getByTestId("realm-map-scale-label")).toHaveTextContent("1,000 km");

    rerender(<RealmMapScale map={map} radiusKm={EARTH_RADIUS_KM / 2} />);
    expect(screen.getByTestId("realm-map-scale-label")).toHaveTextContent("500 km");

    act(() => handlers.get("mousemove")!({ lngLat: { lng: -12.5, lat: 41.25 } }));
    act(flush);
    expect(screen.getByTestId("realm-map-coordinates")).toHaveTextContent("41.25° N, 12.50° W");
    act(() => handlers.get("mouseout")!());
    act(flush);
    expect(screen.getByTestId("realm-map-coordinates")).toBeEmptyDOMElement();
    raf.mockRestore();
  });

  it("formats coordinates with hemispheres, wrapping longitude", () => {
    expect(formatLngLat(190, -10)).toBe("10.00° S, 170.00° W");
  });
});

describe("default view", () => {
  const display = (defaultView: { center: [number, number]; zoom: number } | null) =>
    ({ realmId: "r_eurth", defaultView }) as never;

  it("opens the realm's map at its default view once", () => {
    const jumpTo = jest.fn();
    const mapRef = { current: { getMap: () => ({ jumpTo }) } } as never;
    const { rerender } = renderHook(
      ({ ready }) =>
        useRealmDefaultView(mapRef, display({ center: [12, 34], zoom: 3 }), {
          mapReady: ready,
          explicitView: false,
        }),
      { initialProps: { ready: false } }
    );
    expect(jumpTo).not.toHaveBeenCalled();
    rerender({ ready: true });
    rerender({ ready: true });
    expect(jumpTo).toHaveBeenCalledTimes(1);
    expect(jumpTo).toHaveBeenCalledWith({ center: [12, 34], zoom: 3 });
  });

  it("keeps a place the page asked for", () => {
    const jumpTo = jest.fn();
    const mapRef = { current: { getMap: () => ({ jumpTo }) } } as never;
    renderHook(() =>
      useRealmDefaultView(mapRef, display({ center: [12, 34], zoom: 3 }), {
        mapReady: true,
        explicitView: true,
      })
    );
    expect(jumpTo).not.toHaveBeenCalled();
  });
});
