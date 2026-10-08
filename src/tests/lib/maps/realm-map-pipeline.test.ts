/** @jest-environment node */
import { artSourceSchema } from "~/lib/maps/realm-map-art";
import {
  fillPipelineFromPreset,
  orderedSteps,
  readRealmMapPipeline,
  realmMapPipelineSchema,
  stepArt,
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
  it("defaults to no art and no rasters", () => {
    expect(realmMapPipelineSchema.parse({})).toEqual({ art: {}, rasters: [] });
  });

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

  it("refuses two raster layers with one id", () => {
    const raster = { id: "geo", label: "Geography", kind: "base", art: "geo" };
    expect(() =>
      realmMapPipelineSchema.parse({
        art: { geo: { repoPath: "geo.png" } },
        rasters: [raster, raster],
      })
    ).toThrow(/unique/);
  });

  it("takes labels typed in as a seed list", () => {
    const pipeline = realmMapPipelineSchema.parse({
      labels: {
        source: "typed in",
        labels: [{ text: "Argic Ocean", kind: "ocean", coordinates: [-33.3, 82.8] }],
      },
    });
    expect(pipeline.labels).toEqual({
      source: "typed in",
      labels: [{ text: "Argic Ocean", kind: "ocean", coordinates: [-33.3, 82.8] }],
    });
  });

  it("lists the art each step reads", () => {
    const pipeline = minimal();
    expect(stepArt(pipeline, "rasters")).toEqual(["geo", "legend"]);
    expect(stepArt(pipeline, "physical")).toEqual([]);
    expect(stepArt(pipeline, "repair")).toEqual([]);
  });

  it("orders steps as a run takes them, once each", () => {
    expect(orderedSteps(["areas", "repair", "rasters", "repair"])).toEqual([
      "repair",
      "rasters",
      "areas",
    ]);
  });
});

describe("the pipeline in Realm.settings", () => {
  it("reads settings.map.pipeline; none is null", () => {
    expect(readRealmMapPipeline({})).toEqual({ pipeline: null, problem: null });
    expect(readRealmMapPipeline({ map: { pipeline: { art: {} } } })).toEqual({
      pipeline: { art: {}, rasters: [] },
      problem: null,
    });
  });

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

  it("Eurth's preset carries its whole map: art, five raster layers, physical layers, labels, flags, view, smoothing", () => {
    expect(preset.rasters.map((r) => r.id)).toEqual([
      "geography",
      "geography-grey",
      "climate",
      "tectonic",
      "currents",
    ]);
    expect(preset.physical?.land).toBe("blank");
    expect(preset.labels && "labels" in preset.labels && preset.labels.labels.length).toBe(83);
    expect(preset.flags).toEqual({ localize: true });
    expect(preset.defaultView).toBe("auto");
    expect(preset.coverage).toEqual({ tolerance: 0.045, smooth: 2 });
    expect(Object.values(preset.art).every((source) => "repoPath" in source)).toBe(true);
  });

  it("fills a realm without a pipeline with all of it", () => {
    expect(fillPipelineFromPreset(null, preset)).toEqual({
      pipeline: preset,
      filled: ["art", "rasters", "physical", "labels", "flags", "defaultView", "coverage"],
      kept: [],
    });
  });

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

  it("force takes every field of the preset", () => {
    const own = realmMapPipelineSchema.parse({ art: { geography: { uploadId: UPLOAD } } });
    expect(fillPipelineFromPreset(own, preset, { force: true }).pipeline).toEqual(preset);
  });
});

describe("an uploaded art file", () => {
  it("keeps the name it was uploaded under, so the panel can show it later", () => {
    const UPLOADED = "d".repeat(64);
    expect(artSourceSchema.parse({ uploadId: UPLOADED, filename: "Eurth climate.png" })).toEqual({
      uploadId: UPLOADED,
      filename: "Eurth climate.png",
    });
    expect(artSourceSchema.parse({ uploadId: UPLOADED })).toEqual({ uploadId: UPLOADED });
    expect(artSourceSchema.safeParse({ repoPath: "a.png", filename: "x" }).success).toBe(false);
  });
});
