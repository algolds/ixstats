/** The presets the Studio offers: the admin's view, drafts first. */
import {
  FACTORY_STUDIO_PRESETS,
  findStudioPreset,
  studioPresets,
  type PresetRow,
} from "~/lib/worldgen/studio-presets";

const row = (over: Partial<PresetRow> & { slug: string }): PresetRow => ({
  name: over.slug,
  builtIn: false,
  archived: false,
  published: null,
  draft: null,
  ...over,
});

describe("studioPresets", () => {
  it("starts from the draft when there is one, else from the published version", () => {
    const presets = studioPresets([
      row({
        slug: "a",
        published: { params: { oceanPercentage: 0.6 } },
        draft: { params: { oceanPercentage: 0.5 } },
      }),
      row({ slug: "b", published: { params: { oceanPercentage: 0.6 } } }),
      row({ slug: "c" }),
    ]);
    expect(presets.map((preset) => preset.params)).toEqual([
      { oceanPercentage: 0.5 },
      { oceanPercentage: 0.6 },
      {},
    ]);
  });

  it("marks drafts and unpublished presets, and leaves out archived ones", () => {
    const presets = studioPresets([
      row({ slug: "a", published: { params: {} }, draft: { params: {} } }),
      row({ slug: "b", draft: { params: {} } }),
      row({ slug: "gone", archived: true, published: { params: {} } }),
    ]);
    expect(presets.map(({ slug, hasDraft, published }) => [slug, hasDraft, published])).toEqual([
      ["a", true, true],
      ["b", true, false],
    ]);
  });

  it("falls back to the three built-ins from code", () => {
    expect(FACTORY_STUDIO_PRESETS.map((preset) => preset.slug)).toEqual([
      "earthlike",
      "ixnay",
      "eurth",
    ]);
    expect(FACTORY_STUDIO_PRESETS.every((preset) => preset.builtIn && preset.published)).toBe(true);
  });

  it("finds a preset, else Earth-like, else the first", () => {
    const presets = studioPresets([row({ slug: "earthlike" }), row({ slug: "x" })]);
    expect(findStudioPreset(presets, "x")?.slug).toBe("x");
    expect(findStudioPreset(presets, "missing")?.slug).toBe("earthlike");
    expect(findStudioPreset([presets[1]!], "missing")?.slug).toBe("x");
    expect(findStudioPreset([], "x")).toBeUndefined();
  });
});
