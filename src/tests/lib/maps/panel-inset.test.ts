import { coveredRight } from "~/lib/maps/panel-inset";

const rect = (left: number, top: number, right: number, bottom: number) =>
  ({ left, top, right, bottom }) as DOMRectReadOnly;

describe("coveredRight", () => {
  it("returns the width of the map under a panel floating over its right side", () => {
    expect(coveredRight(rect(0, 0, 800, 300), rect(500, 12, 788, 288))).toBe(300);
  });

  it("returns 0 when the panel is stacked below the map (phones)", () => {
    expect(coveredRight(rect(0, 0, 400, 220), rect(0, 232, 400, 600))).toBe(0);
  });

  it("returns 0 when either box is missing", () => {
    const r = rect(0, 0, 400, 220);
    expect(coveredRight(null, r)).toBe(0);
    expect(coveredRight(r, null)).toBe(0);
  });
});
