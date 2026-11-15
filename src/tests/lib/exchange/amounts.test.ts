import { centsOf } from "~/lib/exchange/amounts";

describe("centsOf", () => {
  it("reads a database bigint as a number of cents", () => {
    expect(centsOf(1234n)).toBe(1234);
    expect(centsOf(0n)).toBe(0);
  });

  it("passes a whole number of cents through", () => {
    expect(centsOf(1234)).toBe(1234);
    expect(centsOf(-500)).toBe(-500);
  });

  it("refuses a fractional or unsafe number", () => {
    expect(() => centsOf(12.5)).toThrow(RangeError);
    expect(() => centsOf(Number.NaN)).toThrow(RangeError);
    expect(() => centsOf(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
  });

  it("refuses a bigint past the safe integer range", () => {
    expect(() => centsOf(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });
});
