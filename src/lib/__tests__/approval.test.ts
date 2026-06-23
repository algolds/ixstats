import { computeApproval, isNewsworthySwing } from "../approval";

describe("computeApproval", () => {
  it("tracks the leading party and lifts with high stability", () => {
    const parties = [
      { id: "a", currentSupport: 41 },
      { id: "b", currentSupport: 38 },
    ];
    expect(computeApproval(parties, 0.5)).toBe(41); // neutral stability, no adj
    expect(computeApproval(parties, 1)).toBe(51); // +10 at full stability
    expect(computeApproval(parties, 0)).toBe(31); // -10 at zero stability
  });

  it("clamps to 0..100 and falls back to stability with no parties", () => {
    expect(computeApproval([], 0.7)).toBe(70);
    expect(computeApproval([{ id: "a", currentSupport: 99 }], 1)).toBe(100);
  });
});

describe("isNewsworthySwing", () => {
  it("flags swings at or beyond the threshold only", () => {
    expect(isNewsworthySwing(40, 46)).toBe(true);
    expect(isNewsworthySwing(40, 43)).toBe(false);
    expect(isNewsworthySwing(40, 35)).toBe(true);
  });
});
