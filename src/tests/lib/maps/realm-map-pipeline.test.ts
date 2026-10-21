/** @jest-environment node */
import {
  fillPipelineFromPreset,
  readRealmMapPipeline,
  realmMapPipelineSchema,
  withRealmMapPipeline,
  type RealmMapPipeline,
} from "~/lib/maps/realm-map-pipeline";
import { sourcePreset } from "~/lib/realms/sources/presets";

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

  it("refuses a step that names art the config does not have, at the field naming it", () => {
    const parsed = realmMapPipelineSchema.safeParse({
      art: {},
      rasters: [{ id: "geo", label: "Geography", kind: "base", art: "geo" }],
      physical: { land: "blank" },
      labels: { art: "labels" },
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["rasters.0.art", 'No art named "geo"'],
      ["physical", 'No art named "blank"'],
      ["labels.art", 'No art named "labels"'],
    ]);
  });
});

describe("the pipeline in Realm.settings", () => {
  it("reports a stored config that no longer parses instead of using it", () => {
    const read = readRealmMapPipeline({ map: { pipeline: { physical: { land: "blank" } } } });
    expect(read.pipeline).toBeNull();
    expect(read.problem).toBe('physical: No art named "blank"');
  });

  it("writes the pipeline beside every other setting, and null removes it", () => {
    const settings = { wiki: { source: "iiwiki" }, map: { radiusKm: 6000, pipeline: { art: {} } } };
    const written = withRealmMapPipeline(settings, minimal());
    expect(written).toEqual({
      wiki: { source: "iiwiki" },
      map: { radiusKm: 6000, pipeline: minimal() },
    });
    expect(withRealmMapPipeline(written, null)).toEqual({
      wiki: { source: "iiwiki" },
      map: { radiusKm: 6000 },
    });
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
