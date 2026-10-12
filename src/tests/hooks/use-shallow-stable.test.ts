import { renderHook } from "@testing-library/react";
import { useShallowStable } from "~/hooks/useShallowStable";

describe("useShallowStable", () => {
  const fn = () => {};

  it("returns the same object while every property is unchanged", () => {
    const { result, rerender } = renderHook(({ value }) => useShallowStable(value), {
      initialProps: { value: { a: 1, b: "x", fn } },
    });
    const first = result.current;

    rerender({ value: { a: 1, b: "x", fn } });

    expect(result.current).toBe(first);
  });

  it("returns the new object as soon as a property changes", () => {
    const { result, rerender } = renderHook(({ value }) => useShallowStable(value), {
      initialProps: { value: { a: 1, list: [1] } },
    });
    const first = result.current;
    const list = [1];

    rerender({ value: { a: 1, list } });

    expect(result.current).not.toBe(first);
    expect(result.current.list).toBe(list);
  });

  it("treats a property that appears or disappears as a change", () => {
    type Shape = { a: number; b?: number };
    const { result, rerender } = renderHook(({ value }) => useShallowStable<Shape>(value), {
      initialProps: { value: { a: 1 } as Shape },
    });
    const first = result.current;

    rerender({ value: { a: 1, b: undefined } });

    expect(result.current).not.toBe(first);
  });
});
