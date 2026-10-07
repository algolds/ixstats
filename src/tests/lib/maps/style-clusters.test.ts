import standard from "~/lib/map-styles/standard.json";
import dark from "~/lib/map-styles/dark.json";
import paper from "~/lib/map-styles/paper.json";
import { MAP_DEFAULTS } from "~/lib/maps/map-config";

type Source = { cluster?: boolean; clusterMaxZoom?: number };

describe("map style clusters", () => {
  it.each([
    ["standard", standard],
    ["dark", dark],
    ["paper", paper],
  ])("%s: every clustered source fully unclusters before the viewer's max zoom", (_name, style) => {
    const clustered = Object.entries(style.sources as Record<string, Source>).filter(
      ([, s]) => s.cluster
    );
    expect(clustered.length).toBeGreaterThan(0);
    for (const [, source] of clustered) {
      expect(source.clusterMaxZoom).toBeLessThan(MAP_DEFAULTS.maxZoom);
    }
  });
});
