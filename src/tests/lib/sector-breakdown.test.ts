import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";

describe("parseSectorBreakdown", () => {
  it("reads the builder's array format", () => {
    const raw = JSON.stringify([
      { name: "Services", gdp: 61.5, employment: 70 },
      { name: "Manufacturing", gdp: 24 },
    ]);
    expect(parseSectorBreakdown(raw)).toEqual([
      { name: "Services", share: 61.5 },
      { name: "Manufacturing", share: 24 },
    ]);
  });

  it("reads a flat record of shares", () => {
    expect(parseSectorBreakdown('{"services":58,"industry":32,"agriculture":10}')).toEqual([
      { name: "services", share: 58 },
      { name: "industry", share: 32 },
      { name: "agriculture", share: 10 },
    ]);
  });

  it("drops entries without a name or a positive share", () => {
    const raw = JSON.stringify([
      { name: "Mining" },
      { gdp: 12 },
      { name: "Tourism", gdp: 0 },
      { name: "Finance", gdpContribution: 9 },
    ]);
    expect(parseSectorBreakdown(raw)).toEqual([{ name: "Finance", share: 9 }]);
  });

  it("returns nothing for missing, invalid or non-sector data", () => {
    expect(parseSectorBreakdown(null)).toEqual([]);
    expect(parseSectorBreakdown(undefined)).toEqual([]);
    expect(parseSectorBreakdown("not json")).toEqual([]);
    expect(parseSectorBreakdown('{"economicModel":"Mixed Economy","primarySectors":[]}')).toEqual(
      []
    );
  });
});
