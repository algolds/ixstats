import { assessReach, fogNumber } from "./diplo-intel";

describe("assessReach — reach drives clarity", () => {
  it("embassy → revealed", () => {
    expect(assessReach({ hasEmbassy: true, relationStrength: 0 }).level).toBe("revealed");
  });
  it("ties but no embassy → questioned", () => {
    expect(assessReach({ hasEmbassy: false, relationStrength: 55 }).level).toBe("questioned");
  });
  it("no reach → greyed", () => {
    expect(assessReach({ hasEmbassy: false, relationStrength: 10 }).level).toBe("greyed");
  });
});

describe("fogNumber — never fabricates", () => {
  it("revealed is exact, greyed is null", () => {
    expect(fogNumber(12345, "revealed")).toBe(12345);
    expect(fogNumber(12345, "greyed")).toBeNull();
    expect(fogNumber(null, "revealed")).toBeNull();
  });
  it("questioned is a coarse estimate of the real value (not invented)", () => {
    // 2 sig figs: 12345 → 12000, real magnitude preserved
    expect(fogNumber(12345, "questioned")).toBe(12000);
    expect(fogNumber(87.6, "questioned")).toBe(88);
  });
});
