import { act, renderHook } from "@testing-library/react";
import {
  transientMapStore,
  useLiveBorderArea,
} from "~/components/maps/editor/utils/transientStore";

let flushFrames: (() => void) | null = null;

/** Steps the store's animation frame by hand. */
function controlledFrames() {
  const queue: FrameRequestCallback[] = [];
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => queue.push(cb));
  const flush = () => act(() => queue.splice(0).forEach((cb) => cb(0)));
  flushFrames = flush;
  return flush;
}

afterEach(() => {
  // Settle the store's pending frame so the next test starts from an idle store
  transientMapStore.setBorderAreaKm2(null);
  flushFrames?.();
  flushFrames = null;
  jest.restoreAllMocks();
});

describe("useLiveBorderArea", () => {
  it("reads the committed area until a drag publishes a live one", () => {
    const frame = controlledFrames();
    const { result } = renderHook(() => useLiveBorderArea(1200));
    expect(result.current).toBe(1200);

    transientMapStore.setBorderAreaKm2(1250);
    frame();
    expect(result.current).toBe(1250);
  });

  it("falls back to the committed area when the live one is cleared", () => {
    const frame = controlledFrames();
    const { result } = renderHook(() => useLiveBorderArea(1300));
    transientMapStore.setBorderAreaKm2(1350);
    frame();

    transientMapStore.setBorderAreaKm2(null);
    frame();
    expect(result.current).toBe(1300);
  });

  it("notifies at most once per frame however many drag frames publish", () => {
    const frame = controlledFrames();
    const seen: Array<number | null> = [];
    const { result } = renderHook(() => {
      const area = useLiveBorderArea(null);
      seen.push(area);
      return area;
    });
    const rendersBefore = seen.length;

    for (let i = 1; i <= 5; i++) transientMapStore.setBorderAreaKm2(100 + i);
    frame();

    expect(result.current).toBe(105);
    expect(seen.length - rendersBefore).toBe(1);
  });
});
