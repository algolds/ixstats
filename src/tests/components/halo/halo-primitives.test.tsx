/** The island morphs via compositor layout animation (no ResizeObserver) and reads the admin play-as target from one hook. */
import { act, render, renderHook } from "@testing-library/react";
import { Halo, HaloProvider, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { usePlayAsTarget } from "~/hooks/usePlayAsTarget";

const constructed = jest.fn();

class CountingResizeObserver {
  constructor() {
    constructed();
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const KEY = "ixstats.play_as_user";

beforeEach(() => {
  constructed.mockClear();
  globalThis.ResizeObserver = CountingResizeObserver as never;
  localStorage.clear();
});

describe("Halo content measurement", () => {
  it("constructs no ResizeObserver because layout animations measure natural height", () => {
    const tree = (label: string) => (
      <HaloProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <Halo id="x">
          <span>{label}</span>
        </Halo>
      </HaloProvider>
    );
    const { rerender } = render(tree("a"));
    rerender(tree("b"));
    rerender(tree("c"));
    rerender(tree("d"));
    expect(constructed).not.toHaveBeenCalled();
  });
});

describe("usePlayAsTarget", () => {
  it("is empty when nobody is being impersonated", () => {
    const { result } = renderHook(() => usePlayAsTarget());
    expect(result.current).toBe("");
  });

  it("follows the play-as change event", () => {
    const { result } = renderHook(() => usePlayAsTarget());
    act(() => {
      localStorage.setItem(KEY, "user_42");
      window.dispatchEvent(new Event("ixstats-play-as-change"));
    });
    expect(result.current).toBe("user_42");
    act(() => {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new Event("ixstats-play-as-change"));
    });
    expect(result.current).toBe("");
  });
});
