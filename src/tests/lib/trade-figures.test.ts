import { tradeFigures } from "~/lib/economy/trade-figures";

describe("tradeFigures", () => {
  it("converts recorded percent-of-GDP into amounts and a balance", () => {
    expect(
      tradeFigures({ nominalGDP: 1000, exportsGDPPercent: 30, importsGDPPercent: 20 })
    ).toEqual({
      exports: 300,
      imports: 200,
      balance: 100,
    });
  });

  it("returns null for anything unrecorded instead of inventing a ratio", () => {
    expect(tradeFigures({ nominalGDP: 1000, exportsGDPPercent: 30 })).toEqual({
      exports: 300,
      imports: null,
      balance: null,
    });
    expect(tradeFigures({ nominalGDP: 0, exportsGDPPercent: 30 }).exports).toBeNull();
    expect(tradeFigures(null).balance).toBeNull();
  });
});
