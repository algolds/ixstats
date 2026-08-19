import { debounce, isEqual } from "~/lib/utils";

describe("debounce", () => {
  jest.useFakeTimers();

  it("should debounce function execution", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced(1);
    debounced(2);
    debounced(3);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("should cancel pending invocation", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced(1);
    debounced.cancel();

    jest.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });
});

describe("isEqual", () => {
  it("should compare primitives correctly", () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual(1, 2)).toBe(false);
    expect(isEqual("a", "a")).toBe(true);
    expect(isEqual("a", "b")).toBe(false);
    expect(isEqual(null, null)).toBe(true);
    expect(isEqual(undefined, undefined)).toBe(true);
    expect(isEqual(null, undefined)).toBe(false);
    expect(isEqual(NaN, NaN)).toBe(true);
  });

  it("should compare dates and regex correctly", () => {
    const d1 = new Date("2026-01-01");
    const d2 = new Date("2026-01-01");
    const d3 = new Date("2026-01-02");
    expect(isEqual(d1, d2)).toBe(true);
    expect(isEqual(d1, d3)).toBe(false);

    expect(isEqual(/abc/g, /abc/g)).toBe(true);
    expect(isEqual(/abc/g, /abc/i)).toBe(false);
  });

  it("should deeply compare nested objects and arrays", () => {
    const objA = { a: 1, b: [2, 3], c: { d: "test" } };
    const objB = { a: 1, b: [2, 3], c: { d: "test" } };
    const objC = { a: 1, b: [2, 4], c: { d: "test" } };
    const objD = { a: 1, b: [2, 3], c: { d: "other" } };

    expect(isEqual(objA, objB)).toBe(true);
    expect(isEqual(objA, objC)).toBe(false);
    expect(isEqual(objA, objD)).toBe(false);
  });
});
