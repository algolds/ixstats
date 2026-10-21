import { AUTO_LINK_MIN_CONFIDENCE, suggestRegionMatches } from "~/lib/maps/nation-name-matching";
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
  it("drops a region two nations claim equally", () => {
    const twins = [
      { id: "a", name: "Aurelia" },
      { id: "b", name: "The Aurelia" },
    ];
    expect(suggestRegionMatches([{ featureId: "f", displayName: "aurelia" }], twins)).toEqual([]);
  });
});
