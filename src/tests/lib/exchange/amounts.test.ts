import { centsOf } from "~/lib/exchange/amounts";

describe("centsOf", () => {
  it("reads a database bigint and a plain number the same way", () => {
    expect(centsOf(12345n)).toBe(12345);
    expect(centsOf(12345)).toBe(12345);
    expect(centsOf(0)).toBe(0);
  });

  it("refuses a value past the safe integer range", () => {
    expect(() => centsOf(2n ** 60n)).toThrow(RangeError);
    expect(() => centsOf(1.5)).toThrow(RangeError);
  });
});
