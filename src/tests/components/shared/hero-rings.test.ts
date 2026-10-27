/** The shared country hero's vitality rings: Diplomatic and Efficiency show only with a record. */
import { heroRings } from "~/components/shared/country-hero/HeroSnapshotPanels";

describe("heroRings", () => {
  it("shows Economy and Wellbeing always, and leaves out unrecorded Diplomatic and Efficiency", () => {
    const rings = heroRings({
      economicVitality: 82,
      populationWellbeing: 40,
      diplomaticStanding: null,
      governmentalEfficiency: null,
    });
    expect(rings.map((r) => r.label)).toEqual(["Economy", "Wellbeing"]);
  });

  it("shows all four with a full record", () => {
    const rings = heroRings({
      economicVitality: 1,
      populationWellbeing: 2,
      diplomaticStanding: 3,
      governmentalEfficiency: 4,
    });
    expect(rings.map((r) => r.value)).toEqual([1, 2, 3, 4]);
  });

  it("is empty before the ring data arrives", () => {
    expect(heroRings(undefined)).toEqual([]);
  });
});
