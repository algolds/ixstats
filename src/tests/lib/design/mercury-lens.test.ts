import {
  dragDeform,
  hoverDeform,
  pressDeform,
  rubberband,
  toUnit,
} from "~/lib/design/mercury-lens";

describe("mercury lens", () => {
  it("maps a pointer to -1..1 and clamps outside the box", () => {
    expect(toUnit(150, 100, 100)).toBe(0);
    expect(toUnit(100, 100, 100)).toBe(-1);
    expect(toUnit(400, 100, 100)).toBe(1);
  });

  it("rubber-bands: follows less the further it goes, never past its dimension", () => {
    expect(rubberband(10, 96)).toBeLessThan(10);
    expect(rubberband(1000, 96)).toBeLessThan(96);
    expect(rubberband(-40, 96)).toBe(-rubberband(40, 96));
  });

  it("presses toward the pointer with a swell", () => {
    expect(pressDeform(1, -1)).toEqual({ x: 6, y: -4, sx: 1.038 });
  });

  it("drags with the press swell fading and the stretch along the faster axis", () => {
    const still = dragDeform({ x: 0, y: 0 }, 0, 0, 0, 0);
    expect(still.sx).toBeCloseTo(1.034);
    const sideways = dragDeform({ x: 0, y: 0 }, 120, 0, 2000, 0);
    expect(sideways.sx).toBeGreaterThan(1);
    expect(sideways.x).toBeGreaterThan(0);
    const upward = dragDeform({ x: 0, y: 0 }, 0, 120, 0, 2000);
    expect(upward.sx).toBeLessThan(1);
    expect(dragDeform({ x: 0, y: 0 }, 9999, 0, 99999, 0).sx).toBeLessThanOrEqual(1.08);
  });

  it("hovers toward the pointer and rests at the centre", () => {
    expect(hoverDeform(0, 0)).toEqual({ x: 0, y: 0, sx: 1 });
    expect(hoverDeform(1, 0)).toEqual({ x: 5, y: 0, sx: 1.014 });
  });
});
