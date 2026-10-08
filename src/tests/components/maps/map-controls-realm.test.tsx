/**
 * The map's layer panel on a realm: switches only for the layers the realm has, its base map choice (or none)
 * and overlay switches, the country names switch while a base map is shown, a raster layer's key while that layer
 * is on, and the climate legend in the realm's own classification.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MapControls, type RasterControls } from "~/components/maps/core/MapControls";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { RealmRasterLayer } from "~/lib/maps/realm-map-settings";

const art = (over: Partial<RealmRasterLayer>): RealmRasterLayer => ({
  id: "geography",
  label: "Geography",
  kind: "base",
  version: "aaaaaaaa",
  maxZoom: 5,
  ...over,
});

function raster(over: Partial<RasterControls> = {}): RasterControls {
  return {
    realmId: "r1",
    layers: [
      art({}),
      art({ id: "geography-grey", label: "Grey" }),
      art({ id: "climate", label: "Climate", kind: "overlay", order: 1 }),
    ],
    selection: { base: "geography", overlays: [] },
    onBaseChange: jest.fn(),
    onToggleOverlay: jest.fn(),
    ...over,
  };
}

function openLayers(props: Partial<React.ComponentProps<typeof MapControls>> = {}) {
  const onToggleLayer = jest.fn();
  render(
    <MapControls
      visibleLayers={new Set<MapLayerType>(["political"])}
      onToggleLayer={onToggleLayer}
      {...props}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Layers" }));
  return { panel: screen.getByRole("region", { name: "Map layers" }), onToggleLayer };
}

const checkboxNames = (panel: HTMLElement) =>
  within(panel)
    .getAllByRole("checkbox")
    .map((c) => c.closest("label")?.textContent);

describe("layer panel on a realm", () => {
  it("offers every switch when the layer types are not known (IxWorld)", () => {
    const { panel } = openLayers();
    expect(checkboxNames(panel)).toEqual([
      "Countries",
      "Climate Zones",
      "Rivers",
      "Lakes",
      "Ice Caps",
    ]);
    expect(within(panel).queryByRole("radiogroup")).toBeNull();
  });

  it("offers only the layers the realm has", () => {
    const { panel } = openLayers({ layerTypes: ["political", "rivers", "icecaps"] });
    expect(checkboxNames(panel)).toEqual(["Countries", "Rivers", "Ice Caps"]);
  });

  it("chooses one base map or none, and switches overlays and country names", () => {
    const controls = raster();
    const { panel, onToggleLayer } = openLayers({ layerTypes: ["political"], raster: controls });
    const bases = within(panel).getByRole("radiogroup", { name: "Base map" });
    expect(
      within(bases)
        .getAllByRole("radio")
        .map((r) => r.textContent)
    ).toEqual(["Geography", "Grey", "None"]);
    expect(within(bases).getByRole("radio", { name: "Geography" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(within(bases).getByRole("radio", { name: "None" }));
    expect(controls.onBaseChange).toHaveBeenCalledWith(null);
    fireEvent.click(within(bases).getByRole("radio", { name: "Grey" }));
    expect(controls.onBaseChange).toHaveBeenLastCalledWith("geography-grey");

    expect(checkboxNames(panel)).toEqual(["Countries", "Country Names", "Climate"]);
    fireEvent.click(within(panel).getByRole("checkbox", { name: "Climate" }));
    expect(controls.onToggleOverlay).toHaveBeenCalledWith("climate");
    fireEvent.click(within(panel).getByRole("checkbox", { name: "Country Names" }));
    expect(onToggleLayer).toHaveBeenCalledWith("country_labels");
  });

  it("offers the country names switch only while a base map is shown", () => {
    const { panel } = openLayers({
      layerTypes: ["political"],
      raster: raster({ selection: { base: null, overlays: [] } }),
    });
    expect(checkboxNames(panel)).toEqual(["Countries", "Climate"]);
  });

  it("shows a raster layer's key in the panel only while that layer is on", () => {
    const layers = [
      art({ legend: true }),
      art({ id: "climate", label: "Climate", kind: "overlay", order: 1, legend: true }),
      art({ id: "currents", label: "Ocean currents", kind: "overlay", order: 3 }),
    ];
    const { panel } = openLayers({
      layerTypes: ["political"],
      raster: raster({ layers, selection: { base: null, overlays: ["climate", "currents"] } }),
    });
    expect(within(panel).queryByRole("img", { name: "Geography key" })).toBeNull();
    const key = within(panel).getByRole("img", { name: "Climate key" });
    expect(key).toHaveAttribute("src", "/api/map-rasters/r1/climate/aaaaaaaa/legend");
    expect(key.closest("a")).toHaveAttribute("target", "_blank");
    expect(within(panel).queryByRole("img", { name: "Ocean currents key" })).toBeNull();
  });

  it("shows the climate legend in the realm's classification when it has one", () => {
    const { panel } = openLayers({
      visibleLayers: new Set<MapLayerType>(["political", "climate"]),
      climateKey: {
        system: "Köppen",
        zones: [{ code: "Af", name: "Tropical rainforest", color: "#0000fe" }],
      },
    });
    expect(within(panel).getByText("Af: Tropical rainforest")).toBeInTheDocument();
  });

  it("keeps the Trewartha legend without one", () => {
    const { panel } = openLayers({
      visibleLayers: new Set<MapLayerType>(["political", "climate"]),
    });
    expect(within(panel).queryByText("Af: Tropical rainforest")).toBeNull();
    expect(within(panel).getAllByText(/^[A-Z][a-z]*: /).length).toBeGreaterThan(3);
  });
});
