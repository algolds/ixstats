import { EARTH_RADIUS_KM } from "~/lib/maps/planet";
import {
  isMapBaseImageUrl,
  parseRealmMapSettings,
  realmRadiusKm,
  withRealmMapSettings,
} from "~/lib/maps/realm-map-settings";
import {
  fillPipelineFromPreset,
  readRealmMapPipeline,
  realmMapPipelineSchema,
  type RealmMapPipeline,
} from "~/lib/maps/realm-map-pipeline";
import { sourcePreset } from "~/lib/realms/sources/presets";
describe("Realm.settings.map", () => {
  it("reads each key on its own and drops malformed ones", () => {
    const settings = {
      maxNationsPerUser: 2,
      map: {
        radiusKm: 3000,
        attribution: "  Map by the Eurth community  ",
        baseImage: "javascript:alert(1)",
        defaultView: { center: [10, 200], zoom: 3 },
        projection: { kind: "equirectangular" },
        controlPoints: [[0, 0]],
      },
    };
    // A malformed projection and control points are dropped like any other malformed key.
    expect(parseRealmMapSettings(settings)).toEqual({
      radiusKm: 3000,
      attribution: "Map by the Eurth community",
    });
  });

  it("defaults the planet radius to Earth's, and refuses an implausible one", () => {
    expect(realmRadiusKm(null)).toBe(EARTH_RADIUS_KM);
    expect(realmRadiusKm({ map: { radiusKm: 12 } })).toBe(EARTH_RADIUS_KM);
    expect(realmRadiusKm({ map: { radiusKm: 8000 } })).toBe(8000);
  });

  it("takes a base image from https or the app's upload storage only", () => {
    expect(isMapBaseImageUrl("https://example.org/eurth.png")).toBe(true);
    expect(isMapBaseImageUrl("/images/uploads/uploaded_abc123.png")).toBe(true);
    expect(isMapBaseImageUrl("http://example.org/eurth.png")).toBe(false);
    expect(isMapBaseImageUrl("/images/uploads/../secret.png")).toBe(false);
    expect(isMapBaseImageUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("changes the map keys and keeps every other setting", () => {
    const stored = { maxNationsPerUser: 3, map: { radiusKm: 3000, attribution: "Old" } };
    expect(
      withRealmMapSettings(stored, {
        attribution: null,
        defaultView: { center: [1, 2], zoom: 4 },
        radiusKm: undefined,
      })
    ).toEqual({
      maxNationsPerUser: 3,
      map: { radiusKm: 3000, defaultView: { center: [1, 2], zoom: 4 } },
    });
  });
});

describe("Realm.settings.map georeference", () => {
  it("saves a georeference without dropping the wiki map's keys", () => {
    const stored = {
      maxNationsPerUser: 2,
      map: { source: "iiwiki", file: "File:Eurth.png", radiusKm: 4000 },
    };
    expect(
      withRealmMapSettings(stored, {
        projection: "equirectangular",
        bounds: { west: -20, south: -10, east: 20, north: 10 },
        controlPoints: null,
      })
    ).toEqual({
      maxNationsPerUser: 2,
      map: {
        source: "iiwiki",
        file: "File:Eurth.png",
        radiusKm: 4000,
        projection: "equirectangular",
        bounds: { west: -20, south: -10, east: 20, north: 10 },
      },
    });
  });
});

describe("the realm map pipeline's config", () => {
  const UPLOAD = "a".repeat(64);
  const minimal = (): RealmMapPipeline =>
    realmMapPipelineSchema.parse({
      art: { geo: { repoPath: "maps/geo.png" }, legend: { uploadId: UPLOAD } },
      rasters: [{ id: "geo", label: "Geography", kind: "base", art: "geo", legendArt: "legend" }],
    });
  describe("realm map pipeline config", () => {
    it("takes art from the source repository or an upload, nothing else", () => {
      expect(minimal().art).toEqual({
        geo: { repoPath: "maps/geo.png" },
        legend: { uploadId: UPLOAD },
      });
      expect(() =>
        realmMapPipelineSchema.parse({ art: { geo: { repoPath: "../secret.png" } } })
      ).toThrow();
      expect(() =>
        realmMapPipelineSchema.parse({ art: { geo: { url: "https://example.com/geo.png" } } })
      ).toThrow();
    });
  });
  describe("the pipeline in Realm.settings", () => {
    it("reports a stored config that no longer parses instead of using it", () => {
      const read = readRealmMapPipeline({ map: { pipeline: { physical: { land: "blank" } } } });
      expect(read.pipeline).toBeNull();
      expect(read.problem).toBe('physical: No art named "blank"');
    });
  });
  describe("loading a preset", () => {
    const preset = sourcePreset("eurth-map")!.mapPipeline!;
    it("keeps what the realm has and fills only the empty fields; its own art is never replaced", () => {
      const own = realmMapPipelineSchema.parse({
        art: { geography: { uploadId: UPLOAD } },
        coverage: { tolerance: 0.1, smooth: 1 },
      });
      const { pipeline, filled, kept } = fillPipelineFromPreset(own, preset);
      expect(pipeline.art.geography).toEqual({ uploadId: UPLOAD });
      expect(pipeline.art.blank).toEqual(preset.art.blank);
      expect(pipeline.coverage).toEqual({ tolerance: 0.1, smooth: 1 });
      expect(pipeline.rasters).toEqual(preset.rasters);
      expect(filled).toEqual(["art", "rasters", "physical", "labels", "flags", "defaultView"]);
      expect(kept).toEqual(["coverage"]);
    });
  });
});
