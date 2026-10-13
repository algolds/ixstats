/** The fields a realm's map decides are the founder World tab's, under the Studio's names. */
import { STUDIO_FIELDS, type StudioKey } from "~/lib/worldgen/studio-fields";
import { controlAvailability, type ControlName } from "~/lib/worldgen/world-controls";

const STUDIO_KEY: Record<ControlName, StudioKey> = {
  continents: "continentCount",
  landShare: "oceanPercentage",
  nations: "countryCountRange",
  temperature: "temperatureOffset",
  rainfall: "precipitationScale",
  developmentLevel: "developmentLevel",
  latitudeBand: "continentLatitudeRange",
  sizeSpread: "continentSizeVariance",
  islands: "islandShare",
  polar: "polarLand",
  hypsometry: "hypsometry",
  rivers: "riverDensity",
  lakes: "lakeCoverage",
  coastComplexity: "coastlineComplexity",
};

const CONTROL_NAMES = Object.keys(controlAvailability("preset")) as ControlName[];

describe("fromMap", () => {
  it("is the founder's FROM_REALM_MAP, field for field", () => {
    const founderOff = CONTROL_NAMES.filter((name) => !controlAvailability("realm-map")[name]).map(
      (name) => STUDIO_KEY[name]
    );
    const studioOff = (Object.keys(STUDIO_FIELDS) as StudioKey[]).filter((key) => {
      const spec = STUDIO_FIELDS[key];
      return "fromMap" in spec && spec.fromMap;
    });
    expect([...studioOff].sort()).toEqual([...founderOff].sort());
  });

  it("maps every founder control", () => {
    expect(Object.keys(STUDIO_KEY).sort()).toEqual([...CONTROL_NAMES].sort());
  });
});
