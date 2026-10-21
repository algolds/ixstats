import {
  draftPipeline,
  stableJson,
  toDraft,
  validateDraft
} from "~/app/admin/realms/_components/map-pipeline/pipeline-draft";
import type { RealmMapPipeline } from "~/lib/maps/realm-map-pipeline";
import { sourcePreset } from "~/lib/realms/sources/presets";

const base: RealmMapPipeline = {
  art: { blank: { repoPath: "Blank.png" }, geography: { repoPath: "Geo.png" } },
  rasters: [{ id: "geography", label: "Geography", kind: "base", art: "geography" }],
  physical: { land: "blank" },
};
describe("map pipeline draft", () => {
  it("round-trips Eurth's preset unchanged and valid", () => {
    const preset = sourcePreset("eurth-map")!.mapPipeline!;
    const draft = toDraft(preset);
    expect(stableJson(draftPipeline(draft))).toBe(stableJson(preset));
    const { pipeline, errors } = validateDraft(draft);
    expect(errors).toEqual({});
    expect(stableJson(pipeline)).toBe(stableJson(preset));
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
});
