import { render } from "@testing-library/react";

jest.mock("~/lib/maps/geojson-layer-helpers", () => ({
  setOrUpdateGeoJSONSource: jest.fn(),
  ensureMapLayer: jest.fn(),
  removeLayerAndSource: jest.fn(),
}));

import { ChoroplethOverlay } from "~/components/maps/overlays/ChoroplethOverlay";
import { RiskHeatmapOverlay } from "~/components/maps/overlays/RiskHeatmapOverlay";
import { OVERLAY_LIST } from "~/lib/maps/overlay-registry";

function stubMap() {
  return {
    getLayer: jest.fn(() => ({})),
    setPaintProperty: jest.fn(),
    setLayoutProperty: jest.fn(),
  };
}

/** The `[countryId, colour]` pairs of the `match` expression the overlay painted the political fill with. */
function paintedCountries(map: ReturnType<typeof stubMap>): string[] {
  const [, property, expression] = map.setPaintProperty.mock.calls.at(-1)!;
  expect(property).toBe("fill-color");
  expect(expression.slice(0, 2)).toEqual(["match", ["get", "_countryId"]]);
  return expression.slice(2, -1).filter((_: string, i: number) => i % 2 === 0);
}

const asMap = (map: ReturnType<typeof stubMap>) => map as never;

describe("fill overlays colour the political layer from country rows, with no geometry", () => {
  it("ChoroplethOverlay paints each row's countryId by its value", () => {
    const map = stubMap();
    render(
      <ChoroplethOverlay
        map={asMap(map)}
        rows={[
          { countryId: "c1", value: 0 },
          { countryId: "c2", value: 1 },
        ]}
        visible
        layerId="wealth"
        colorScale="wealth"
      />
    );
    expect(paintedCountries(map)).toEqual(["c1", "c2"]);
  });

  it("RiskHeatmapOverlay paints each row's countryId by its risk value", () => {
    const map = stubMap();
    render(
      <RiskHeatmapOverlay
        map={asMap(map)}
        riskRows={[{ countryId: "c9", value: 0.5 }]}
        crisisEvents={{ type: "FeatureCollection", features: [] }}
        visible
      />
    );
    expect(paintedCountries(map)).toEqual(["c9"]);
  });

  it.each([
    "wealth",
    "population",
    "economicTier",
    "vitality",
    "health",
    "tradeBalance",
    "canonDensity",
  ])("the %s overlay hands the fetched rows and metadata to ChoroplethOverlay", (id) => {
    const def = OVERLAY_LIST.find((overlay) => overlay.id === id)!;
    const data = {
      rows: [{ countryId: "c1", value: 0.25 }],
      metadata: { minVal: 0, maxVal: 1 },
    };
    const props = def.renderProps!({ map: null, data, visible: true });
    expect(props).toMatchObject({ rows: data.rows, metadata: data.metadata, visible: true });
  });

  it("the crises overlay hands the risk rows and the event points to RiskHeatmapOverlay", () => {
    const def = OVERLAY_LIST.find((overlay) => overlay.id === "crises")!;
    const crisisEvents = { type: "FeatureCollection", features: [] };
    const data = { rows: [{ countryId: "c1", value: 0.7 }], crisisEvents };
    expect(def.renderProps!({ map: null, data, visible: true })).toMatchObject({
      riskRows: data.rows,
      crisisEvents,
    });
  });
});
