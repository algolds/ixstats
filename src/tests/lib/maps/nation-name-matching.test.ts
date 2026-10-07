import {
  AUTO_LINK_MIN_CONFIDENCE,
  coreName,
  nameSimilarity,
  normalizeName,
  suggestRegionMatches,
} from "~/lib/maps/nation-name-matching";

describe("normalising nation names", () => {
  it("ignores case, accents, hyphens, underscores, punctuation and a leading The", () => {
    expect(normalizeName("The Grand-Duchy_of  Lüxembourg!")).toBe("grand duchy of luxembourg");
    expect(normalizeName("Côte d'Ivoire")).toBe("cote divoire");
    expect(normalizeName("Saint_Kitts-and-Nevis")).toBe("saint kitts and nevis");
  });

  it("drops state-form prefixes for the core name", () => {
    expect(coreName("Republic of Gallambria")).toBe("gallambria");
    expect(coreName("The Kingdom of the Ostian Isles")).toBe("ostian isles");
    expect(coreName("Federal Republic of Bergmark")).toBe("bergmark");
    expect(coreName("Gallambria")).toBe("gallambria");
  });

  it("scores spellings by edit distance", () => {
    expect(nameSimilarity("gallambria", "gallambria")).toBe(1);
    expect(nameSimilarity("gallambria", "galambria")).toBeCloseTo(0.9);
    expect(nameSimilarity("ostia", "bergmark")).toBeLessThan(0.3);
  });
});

describe("suggesting region matches", () => {
  const nations = [
    { id: "c_gal", name: "Gallambria", aliases: ["Republic of Gallambria", "GAL"] },
    { id: "c_ost", name: "Ostia" },
    { id: "c_ber", name: "Bergmark", aliases: [null, undefined] },
  ];

  it("matches exact, normalised, state-form, alias and similar names, most confident first", () => {
    const suggestions = suggestRegionMatches(
      [
        { featureId: "Ostia", displayName: null },
        { featureId: "f2", displayName: "the ostia" },
        { featureId: "f3", displayName: "Kingdom of Bergmark" },
        { featureId: "GAL", displayName: null },
        { featureId: "f5", displayName: "Galambria" },
        { featureId: "f6", displayName: "Nowhere" },
      ],
      nations
    );
    expect(suggestions.map((s) => [s.featureId, s.countryId, s.reason, s.confidence])).toEqual([
      ["GAL", "c_gal", "exact", 1],
      ["Ostia", "c_ost", "exact", 1],
      ["f2", "c_ost", "normalized", 0.95],
      ["f3", "c_ber", "state-form", 0.85],
      ["f5", "c_gal", "similar", 0.72],
    ]);
    // Similar spellings are only suggested, never auto-linked
    expect(suggestions.find((s) => s.reason === "similar")!.confidence).toBeLessThan(
      AUTO_LINK_MIN_CONFIDENCE
    );
  });

  it("reads a feature id as a name, and lets several regions match one nation", () => {
    const suggestions = suggestRegionMatches(
      [
        { featureId: "Ostia", displayName: null },
        { featureId: "ostia_2", displayName: "Ostia" },
        { featureId: "Gallambria_Republic", displayName: null },
      ],
      nations
    );
    expect(suggestions.filter((s) => s.countryId === "c_ost").map((s) => s.featureId)).toEqual([
      "Ostia",
      "ostia_2",
    ]);
    expect(suggestions.find((s) => s.featureId === "Gallambria_Republic")).toBeUndefined();
  });

  it("drops a region two nations claim equally", () => {
    const twins = [
      { id: "a", name: "Aurelia" },
      { id: "b", name: "The Aurelia" },
    ];
    expect(suggestRegionMatches([{ featureId: "f", displayName: "aurelia" }], twins)).toEqual([]);
  });
});
