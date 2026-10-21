/** @jest-environment node */
import { nextFinish, rollFinish } from "~/lib/cards/finish";

const odds = { finishFoilPct: 8, finishHoloPct: 2 };

describe("finish", () => {
  it.each([
    [0, "HOLO"],
    [0.0199, "HOLO"],
    [0.02, "FOIL"],
    [0.0999, "FOIL"],
    [0.1, "STANDARD"],
    [0.9999, "STANDARD"],
  ] as const)("a roll of %d is %s", (roll, finish) => {
    expect(rollFinish(odds, () => roll)).toBe(finish);
  });

  it("rolls only Standard when both odds are 0, and only Holo at 100%", () => {
    expect(rollFinish({ finishFoilPct: 0, finishHoloPct: 0 }, () => 0)).toBe("STANDARD");
    expect(rollFinish({ finishFoilPct: 0, finishHoloPct: 100 }, () => 0.9999)).toBe("HOLO");
  });

  it("never rolls Serialised", () => {
    for (let i = 0; i < 1000; i++) expect(rollFinish(odds)).not.toBe("SERIALISED");
  });

  it("fuses Standard into Foil and Foil into Holo, and nothing further", () => {
    expect(nextFinish("STANDARD")).toBe("FOIL");
    expect(nextFinish("FOIL")).toBe("HOLO");
    expect(nextFinish("HOLO")).toBeNull();
    expect(nextFinish("SERIALISED")).toBeNull();
  });
});
