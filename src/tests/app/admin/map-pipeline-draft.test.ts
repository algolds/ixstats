import {
  artUsage,
  draftPipeline,
  moveItem,
  stableJson,
  toDraft,
  validateDraft,
  type PipelineDraft,
} from "~/app/admin/realms/_components/map-pipeline/pipeline-draft";
import type { RealmMapPipeline } from "~/lib/maps/realm-map-pipeline";
import { sourcePreset } from "~/lib/realms/sources/presets";

const base: RealmMapPipeline = {
  art: { blank: { repoPath: "Blank.png" }, geography: { repoPath: "Geo.png" } },
  rasters: [{ id: "geography", label: "Geography", kind: "base", art: "geography" }],
  physical: { land: "blank" },
};

const draftOf = (pipeline: RealmMapPipeline, patch: Partial<PipelineDraft> = {}) => ({
  ...toDraft(pipeline),
  ...patch,
});

describe("map pipeline draft", () => {
  it("round-trips Eurth's preset unchanged and valid", () => {
    const preset = sourcePreset("eurth-map")!.mapPipeline!;
    const draft = toDraft(preset);
    expect(stableJson(draftPipeline(draft))).toBe(stableJson(preset));
    const { pipeline, errors } = validateDraft(draft);
    expect(errors).toEqual({});
    expect(stableJson(pipeline)).toBe(stableJson(preset));
  });

  it("compares configs whatever order their fields were set in", () => {
    expect(stableJson({ rasters: [], art: {} })).toBe(stableJson({ art: {}, rasters: [] }));
  });

  it("puts art problems at the row: bad names, repeats, empty paths and missing uploads", () => {
    const { pipeline, errors } = validateDraft({
      ...toDraft(base),
      art: [
        { key: "blank", source: { repoPath: "Blank.png" } },
        { key: "geography", source: { repoPath: "" } },
        { key: "geography", source: { uploadId: "" } },
        { key: "Bad Key", source: { repoPath: "x.png" } },
      ],
    });
    expect(pipeline).toBeNull();
    expect(errors["art.1.source"]).toBeDefined();
    expect(errors["art.2.key"]).toBe('"geography" is used twice');
    expect(errors["art.2.source"]).toBe("Upload a file");
    expect(errors["art.3.key"]).toMatch(/lower case letters/);
  });

  it("names the physical field that reads missing art, not just the section", () => {
    const { errors } = validateDraft(
      draftOf(base, {
        physical: { land: "blank", rivers: { art: "relief", colours: ["#5184c8"] } },
      })
    );
    expect(errors).toEqual({ "physical.rivers.art": 'No art named "relief"' });
  });

  it("asks for art on a field that names none yet", () => {
    const { errors } = validateDraft(
      draftOf(base, {
        rasters: [{ id: "relief", label: "Relief", kind: "base", art: "" }],
      })
    );
    expect(errors["rasters.0.art"]).toBe("Choose art");
  });

  it("reports the typed climate key's own fields", () => {
    const { errors } = validateDraft(
      draftOf(base, {
        physical: {
          land: "blank",
          climate: {
            art: "geography",
            key: { system: "Köppen", zones: [{ code: "Af", name: "", color: "#zzzzzz" }] },
          },
        },
      })
    );
    expect(Object.keys(errors).sort()).toEqual([
      "physical.climate.key.zones.0.color",
      "physical.climate.key.zones.0.name",
    ]);
  });

  it("reports a typed label list's own fields", () => {
    const { errors } = validateDraft(
      draftOf(base, {
        labels: { source: "typed", labels: [{ text: "", kind: "sea", coordinates: [200, 0] }] },
      })
    );
    expect(Object.keys(errors).sort()).toEqual([
      "labels.labels.0.coordinates.0",
      "labels.labels.0.text",
    ]);
  });

  it("keeps a whole-list problem, such as repeated raster ids", () => {
    const raster = base.rasters[0]!;
    const { pipeline, errors } = validateDraft(draftOf(base, { rasters: [raster, raster] }));
    expect(pipeline).toBeNull();
    expect(errors.rasters).toBe("Raster layer ids must be unique");
  });

  it("lists the steps that read each art file", () => {
    const usage = artUsage(
      draftOf(base, {
        physical: { land: "blank", ice: { art: "geography" } },
        rasters: [{ ...base.rasters[0]!, legendArt: "blank" }],
      })
    );
    expect(usage).toEqual({
      blank: ["Physical layers", "Raster layers"],
      geography: ["Physical layers", "Raster layers"],
    });
  });

  it("moves an item within the list only", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
