/** @jest-environment node */
/** P2-9: outsiders see a branch's headcount as its 1-2-5 band, a fixed grid no exact figure can be read back from. */
import { formatStrengthBand, strengthBand } from "~/lib/military/owner-redaction";

it.each([
  [0, 0, 0],
  [0.4, 0, 0],
  [1, 1, 2],
  [999, 500, 1_000],
  [1_000, 1_000, 2_000],
  [14_205, 10_000, 20_000],
  [41_000, 20_000, 50_000],
  [1_880_297, 1_000_000, 2_000_000],
  [2_256_356, 2_000_000, 5_000_000],
  [9_999_999, 5_000_000, 10_000_000],
])("%d falls in %d to %d", (n, low, high) => {
  expect(strengthBand(n)).toEqual({ low, high });
});

it("hides the exact figure: neighbours in one band read the same", () => {
  expect(strengthBand(12_001)).toEqual(strengthBand(19_999));
});

it("reads as a range, or None", () => {
  expect(formatStrengthBand({ low: 10_000, high: 20_000 })).toBe("10,000 to 20,000");
  expect(formatStrengthBand({ low: 0, high: 0 })).toBe("None");
});
