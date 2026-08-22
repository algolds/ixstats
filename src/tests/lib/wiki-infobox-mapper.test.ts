import { mapInfoboxToIxStats, deriveGovCategory } from "~/lib/wiki-os/adapters/ixstates/infobox-mapper";

// Guardrail: the wiki government_type string is canon. The importer must store it
// VERBATIM — if anyone re-adds a transform that collapses it into buckets, these go
// red. See plans/mycountry-lore-alignment*.md.
describe("government_type is preserved verbatim on import", () => {
  // Real, bespoke forms from the live wiki that a bucketing transform would destroy.
  const bespoke = [
    "Unitary Quaternalist Republic",
    "Federal demarchy",
    "Apostolic elective monarchy",
    "Unitary constitutional republic",
    "Dual federalist hierarchy",
    "The Woqalate",
  ];

  it.each(bespoke)("round-trips %s unchanged", (gov) => {
    const mapped = mapInfoboxToIxStats({ government_type: gov });
    expect(mapped.nationalIdentity?.governmentType).toBe(gov);
  });
});

describe("deriveGovCategory (additive, sim-only)", () => {
  it("classifies coarsely without mutating the source", () => {
    expect(deriveGovCategory("Unitary Quaternalist Republic")).toBe("republic");
    expect(deriveGovCategory("Apostolic elective monarchy")).toBe("monarchy");
    expect(deriveGovCategory("Imperial Empire of X")).toBe("empire");
  });

  it("returns undefined rather than fabricating a default", () => {
    expect(deriveGovCategory("Federal demarchy")).toBeUndefined();
    expect(deriveGovCategory("")).toBeUndefined();
    expect(deriveGovCategory(null)).toBeUndefined();
  });
});
