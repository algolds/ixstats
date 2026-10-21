import { applyBlock } from "~/lib/worldgen/studio-apply";

const ixnay = { isIxnay: true };
const eurth = { isIxnay: false };

describe("worldgen/studio-apply", () => {
  it("needs a realm", () => {
    expect(applyBlock({ sourceKind: "preset", target: null, layers: [] })).toBe("Choose a realm.");
    expect(applyBlock({ sourceKind: "fit", target: null, layers: [] })).toMatch(/fit to/);
  });

  it("lets a realm other than Ixnay take a world from either source, with or without a choice", () => {
    expect(applyBlock({ sourceKind: "preset", target: eurth, layers: [] })).toBeNull();
    expect(applyBlock({ sourceKind: "fit", target: eurth, layers: [] })).toBeNull();
    expect(applyBlock({ sourceKind: "fit", target: eurth, layers: ["rivers"] })).toBeNull();
  });

  it("lets Ixnay take only the fit source and at least one ticked layer", () => {
    expect(applyBlock({ sourceKind: "preset", target: ixnay, layers: ["altitudes"] })).toMatch(
      /Fit to a realm's map/
    );
    expect(applyBlock({ sourceKind: "fit", target: ixnay, layers: [] })).toBe(
      "Tick at least one layer to write to Ixnay."
    );
    expect(applyBlock({ sourceKind: "fit", target: ixnay, layers: ["climate"] })).toBeNull();
  });
});
