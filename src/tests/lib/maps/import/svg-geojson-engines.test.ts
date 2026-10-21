/** @jest-environment node */
import type { MultiPolygon, Polygon } from "geojson";
import { runSvgEngine } from "~/lib/maps/import/svg-engine";
import {
  GeojsonImportError,
  inspectGeojson
} from "~/lib/maps/import/geojson-engine";
import { buildNationGeometries } from "~/lib/maps/import/build";
import { resolveGeoreference } from "~/lib/maps/import/georef";
import { polygonPlanarArea } from "~/lib/maps/ring-assembly";

const area = (g: Polygon | MultiPolygon) =>
  (g.type === "Polygon" ? [g.coordinates] : g.coordinates).reduce(
    (s, p) => s + polygonPlanarArea(p),
    0
  );
const xs = (g: Polygon | MultiPolygon) =>
  (g.type === "Polygon" ? g.coordinates.flat() : g.coordinates.flat(2)).map((p) => p[0]!);

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="100 50 400 200">
  <rect x="100" y="50" width="400" height="200" fill="#3366cc" id="ocean"/>
  <g id="political" inkscape:label="Political" transform="translate(100 50)">
    <rect x="0" y="0" width="400" height="200" fill="#2255aa"/>
    <g id="g12"><title>Aurelia</title>
      <rect x="10" y="10" width="80" height="60" fill="#e04040"/>
      <polygon points="100,10 140,10 140,40 100,40" fill="#e04040"/>
    </g>
    <path id="Borealis" d="M 200 10 L 300 10 L 300 110 L 200 110 Z M 230 40 L 270 40 L 270 80 L 230 80 Z" fill="#40b040"/>
    <circle cx="350" cy="150" r="20" fill="#e0c040" inkscape:label="Cyrene"/>
    <g transform="scale(2)"><path d="M 10 60 L 20 60 L 20 70 L 10 70 Z" fill="#9040a0"/></g>
    <path d="M 20 150 A 20 20 0 0 1 60 150 Z" fill="#20a0a0" id="path99"/>
  </g>
  <text x="135" y="195" transform="translate(-5 -10)">Dunmore</text>
</svg>`;

describe("realm SVG engine", () => {
  const result = runSvgEngine(SVG);
  const byName = Object.fromEntries(result.regions.map((r) => [r.name ?? r.key, r]));
  const geometryOf = (key: string) =>
    result.features!.features.find((f) => f.properties.key === key)!.geometry;
  it("applies transforms (the layer's translate and a nested scale) relative to the viewBox", () => {
    const aurelia = geometryOf(byName.Aurelia!.key);
    expect(Math.min(...xs(aurelia))).toBeCloseTo(10, 6); // translate(100 50) less the viewBox origin (100, 50)
    const scaled = result.regions.find((r) => r.colour === "#9040a0")!;
    const g = geometryOf(scaled.key);
    expect(Math.min(...xs(g))).toBeCloseTo(20, 6);
    expect(area(g)).toBeCloseTo(400, 6); // 10×10 scaled by 2
  });

  it("keeps a hole drawn as a subpath, and draws circles and arcs as curves", () => {
    const borealis = geometryOf(byName.Borealis!.key) as Polygon;
    expect(borealis.coordinates).toHaveLength(2);
    expect(area(borealis)).toBeCloseTo(100 * 100 - 40 * 40, 6);
    // A circle is drawn with 32 segments; the arc follows the half circle.
    expect(area(geometryOf(byName.Cyrene!.key)) / (Math.PI * 400)).toBeGreaterThan(0.99);
    const half = result.regions.find((r) => r.colour === "#20a0a0")!;
    expect(area(geometryOf(half.key)) / ((Math.PI * 400) / 2)).toBeGreaterThan(0.97);
  });
  it("builds georeferenced nation borders from the regions", () => {
    const built = buildNationGeometries(
      result,
      { [byName.Aurelia!.key]: "Aurelia", [byName.Borealis!.key]: "Borealis" },
      resolveGeoreference(undefined, result.width, result.height).transform
    );
    expect(built.nations.map((n) => n.nation)).toEqual(["Aurelia", "Borealis"]);
    expect(Math.min(...xs(built.nations[0]!.geometry))).toBeCloseTo(-180 + (10 / 400) * 360, 6);
  });
});
const fc = (features: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "FeatureCollection", features, ...extra });
const square = (x: number, y: number, size: number) => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ],
});

describe("GeoJSON engine", () => {
  const lonlat = fc([
    { type: "Feature", properties: { NAME: "Aurelia", id: 1 }, geometry: square(0, 0, 10) },
    { type: "Feature", properties: { NAME: "Aurelia", id: 2 }, geometry: square(10, 0, 10) },
    { type: "Feature", properties: { NAME: "Borealis", id: 3 }, geometry: square(30, 0, 5) },
    {
      type: "Feature",
      properties: { NAME: "River" },
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    },
  ]);
  it("refuses a projected CRS whose coordinates are not lon/lat", () => {
    const mercator = fc(
      [{ type: "Feature", properties: { NAME: "A" }, geometry: square(1e6, 1e6, 1e5) }],
      {
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::3857" } },
      }
    );
    expect(() => inspectGeojson(mercator)).toThrow(GeojsonImportError);
    const harmless = fc(
      [{ type: "Feature", properties: { NAME: "A" }, geometry: square(1, 1, 1) }],
      {
        crs: { type: "name", properties: { name: "EPSG:3857" } },
      }
    );
    expect(inspectGeojson(harmless).warnings[0]).toMatch(/valid longitude\/latitude/);
  });
});
