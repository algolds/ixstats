import type { Map as MapLibreMap } from "maplibre-gl";
import { applyFlatMode, isFlatMap, type FlatMaplibre } from "./flat-map-adapter";
import { fromCarrierLat, toCarrierLat } from "./flat-projection";

type LL = { lng: number; lat: number };

/** Stand-ins for the MapLibre classes the adapter builds and patches. */
class LngLat {
  constructor(
    public lng: number,
    public lat: number
  ) {}
  static convert(v: LL | [number, number]): LngLat {
    return Array.isArray(v) ? new LngLat(v[0], v[1]) : new LngLat(v.lng, v.lat);
  }
}
class LngLatBounds {
  constructor(
    public sw: [number, number],
    public ne: [number, number]
  ) {}
  static convert(b: [[number, number], [number, number]] | LngLatBounds): LngLatBounds {
    return b instanceof LngLatBounds ? b : new LngLatBounds(b[0], b[1]);
  }
  getWest = () => this.sw[0];
  getSouth = () => this.sw[1];
  getEast = () => this.ne[0];
  getNorth = () => this.ne[1];
}
class GeoJSONSource {
  map: FakeMap | null = null;
  pushed: object | string | null = null;
  setData(data: object | string) {
    this.pushed = data;
    return Promise.resolve();
  }
}
class ImageSource {
  map: FakeMap | null = null;
  corners: number[][] | null = null;
  updateImage(o: { coordinates?: number[][] }) {
    if (o.coordinates) this.corners = o.coordinates;
    return this;
  }
  setCoordinates(c: number[][]) {
    this.corners = c;
    return this;
  }
}
class Feature {
  constructor(private raw: object) {}
  get geometry() {
    return this.raw;
  }
}

/** A map whose camera lives in carrier space, and whose easeTo calls jumpTo, as MapLibre's does. */
class FakeMap {
  center: LL = { lng: 0, lat: 0 };
  jumps: LL[] = [];
  sources = new Map<string, GeoJSONSource | ImageSource>();
  constrain: object | null = null;
  project(ll: [number, number]) {
    return { x: ll[0], y: ll[1] };
  }
  unproject(p: { x: number; y: number }) {
    return new LngLat(p.x, p.y);
  }
  getCenter() {
    return new LngLat(this.center.lng, this.center.lat);
  }
  getZoom = () => 2;
  jumpTo(o: { center?: [number, number] | LL }) {
    if (o.center) this.center = LngLat.convert(o.center);
    this.jumps.push(this.center);
    return this;
  }
  easeTo(o: { center?: [number, number] }) {
    return this.jumpTo(o);
  }
  queryRenderedFeatures() {
    return [new Feature({ type: "Point", coordinates: [10, toCarrierLat(60)] })];
  }
  addSource(id: string, spec: { type: string; data?: object }) {
    const source = spec.type === "geojson" ? new GeoJSONSource() : new ImageSource();
    source.map = this;
    if (source instanceof GeoJSONSource && spec.data) source.pushed = spec.data;
    this.sources.set(id, source);
  }
  getSource = (id: string) => this.sources.get(id);
  getStyle = () => ({ sources: Object.fromEntries([...this.sources.keys()].map((k) => [k, {}])) });
  setTransformConstrain(fn: object | null) {
    this.constrain = fn;
  }
  getContainer = () => ({ clientHeight: 400 });
}

const m = { LngLat, LngLatBounds, GeoJSONSource, ImageSource } as unknown as FlatMaplibre;
const asMap = (fake: FakeMap) => fake as unknown as MapLibreMap;
const point = (lat: number) => ({ type: "Point", coordinates: [5, lat] });

describe("flat-map-adapter", () => {
  it("passes everything through while off", () => {
    const fake = new FakeMap();
    const map = asMap(fake);
    applyFlatMode(map, false, m);
    map.easeTo({ center: [10, 60] });
    expect(fake.center).toEqual({ lng: 10, lat: 60 });
    expect(isFlatMap(map)).toBe(false);
  });

  it("converts a camera call once, though easeTo calls jumpTo inside", () => {
    const fake = new FakeMap();
    const map = asMap(fake);
    applyFlatMode(map, true, m);
    map.easeTo({ center: [10, 60] });
    expect(fake.center.lat).toBeCloseTo(toCarrierLat(60), 9);
    expect(map.getCenter().lat).toBeCloseTo(60, 9);
  });

  it("converts project and unproject, so events, markers and popups see true latitudes", () => {
    const map = asMap(new FakeMap());
    applyFlatMode(map, true, m);
    expect(map.project([0, 45]).y).toBeCloseTo(toCarrierLat(45), 9);
    expect(map.unproject({ x: 0, y: toCarrierLat(-30) } as never).lat).toBeCloseTo(-30, 9);
  });

  it("converts GeoJSON going in, and switching back re-pushes the true data", () => {
    const fake = new FakeMap();
    const map = asMap(fake);
    // Installed at creation (off), as the map engine and the Studio map do, so sources added later are tracked
    applyFlatMode(map, false, m);
    map.addSource("s", { type: "geojson", data: point(10) } as never);
    applyFlatMode(map, true, m);
    const source = fake.sources.get("s") as GeoJSONSource;
    expect((source.pushed as { coordinates: number[] }).coordinates[1]).toBeCloseTo(
      toCarrierLat(10),
      9
    );
    void (source as unknown as { setData: (d: object) => Promise<void> }).setData(point(70));
    expect((source.pushed as { coordinates: number[] }).coordinates[1]).toBeCloseTo(
      toCarrierLat(70),
      9
    );
    applyFlatMode(map, false, m);
    expect(source.pushed).toEqual(point(70));
  });

  it("reads queried geometry back in true coordinates, and keeps the view in place across a switch", () => {
    const fake = new FakeMap();
    const map = asMap(fake);
    fake.center = { lng: 3, lat: 50 };
    applyFlatMode(map, true, m);
    expect(fake.center.lat).toBeCloseTo(toCarrierLat(50), 9);
    expect(fake.constrain).not.toBeNull();
    const [feature] = map.queryRenderedFeatures();
    expect((feature!.geometry as { coordinates: number[] }).coordinates[1]).toBeCloseTo(60, 9);
    applyFlatMode(map, false, m);
    expect(fake.center.lat).toBeCloseTo(fromCarrierLat(toCarrierLat(50)), 9);
    expect(fake.constrain).toBeNull();
  });
});
