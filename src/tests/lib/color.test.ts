import { describe, it, expect } from "@jest/globals";
import {
  hslToHex,
  hslToRgb,
  rgbToHsl,
  hexToRgb,
  hexToHsl,
  parseColorToHsl,
} from "~/lib/color";

describe("src/lib/color.ts", () => {
  it("converts HSL to Hex accurately", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");
    expect(hslToHex(0, 0, 0)).toBe("#000000");
    expect(hslToHex(0, 0, 100)).toBe("#ffffff");
  });

  it("converts HSL to RGB accurately", () => {
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0]);
    expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0]);
    expect(hslToRgb(240, 100, 50)).toEqual([0, 0, 255]);
  });

  it("converts RGB to HSL accurately", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50]);
    expect(rgbToHsl(0, 255, 0)).toEqual([120, 100, 50]);
    expect(rgbToHsl(0, 0, 255)).toEqual([240, 100, 50]);
  });

  it("converts Hex to RGB and Hex to HSL", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToHsl("#00ff00")).toEqual({ h: 120, s: 100, l: 50 });
  });

  it("parses multiple color formats to HSLA", () => {
    expect(parseColorToHsl("#ff0000")).toEqual({ h: 0, s: 100, l: 50, a: 1 });
    expect(parseColorToHsl("rgb(255, 0, 0)")).toEqual({ h: 0, s: 100, l: 50, a: 1 });
    expect(parseColorToHsl("hsl(120, 100%, 50%)")).toEqual({ h: 120, s: 100, l: 50, a: 1 });
    expect(parseColorToHsl({ h: 200, s: 80, l: 40 })).toEqual({ h: 200, s: 80, l: 40, a: 1 });
  });

  it("handles 3-digit shorthand hex and fallback gracefully", () => {
    expect(parseColorToHsl("#f00")).toEqual({ h: 0, s: 100, l: 50, a: 1 });
    expect(parseColorToHsl("invalid-color")).toEqual({ h: 0, s: 0, l: 0, a: 1 });
  });
});
