import { act, renderHook } from "@testing-library/react";

const mockMark = jest.fn();
const mockInvalidate = jest.fn(() => Promise.resolve());
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ thinkpagesForum: { navCounts: { invalidate: mockInvalidate } } }),
    thinkpagesForum: {
      markRealmBoardRead: { useMutation: () => ({ mutateAsync: mockMark }) },
    },
  },
}));

import {
  BOARD_READ_INTERVAL_MS,
  useRealmBoardRead,
} from "~/components/thinkpages-forum/realm/useRealmBoardRead";

beforeEach(() => {
  jest.useFakeTimers();
  mockMark.mockReset();
  mockMark.mockResolvedValue({ readAt: new Date() });
  mockInvalidate.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});
describe("useRealmBoardRead", () => {
  it("marks nothing for a signed-out reader", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", false));
    act(() => result.current.markSeen("p1"));
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS * 2));
    expect(mockMark).not.toHaveBeenCalled();
  });
  it("starts over for another realm: the old realm's waiting mark never fires", () => {
    const { result, rerender } = renderHook(({ slug }) => useRealmBoardRead(slug, true), {
      initialProps: { slug: "eurth" },
    });
    act(() => result.current.markSeen("p1"));
    act(() => result.current.markSeen("p2"));
    rerender({ slug: "kiro" });
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS * 2));
    expect(mockMark).toHaveBeenCalledTimes(1);
    expect(mockMark).toHaveBeenLastCalledWith({ realm: "eurth" });
    // The new realm is not held back by the old one's last mark, and its first message is not taken as seen.
    act(() => result.current.markSeen("p2"));
    expect(mockMark).toHaveBeenCalledTimes(2);
    expect(mockMark).toHaveBeenLastCalledWith({ realm: "kiro" });
  });
  it("skips a waiting mark when the reader has left the top, and marks on the next arrival at the top", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    act(() => result.current.markSeen("p2"));
    act(() => result.current.leaveTop());
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    expect(mockMark).toHaveBeenCalledTimes(1);
    // Back at the top with the newest message: the interval has passed, so it is marked at once.
    act(() => result.current.markSeen("p2"));
    expect(mockMark).toHaveBeenCalledTimes(2);
  });
  describe("in a tab nobody is looking at", () => {
    const show = (state: "visible" | "hidden") => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    afterEach(() => show("visible"));

    it("marks nothing while the tab is hidden, and marks the newest message once it is shown", () => {
      show("hidden");
      const { result } = renderHook(() => useRealmBoardRead("eurth", true));
      act(() => result.current.markSeen("p1"));
      act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS * 3));
      act(() => result.current.markSeen("p2"));
      expect(mockMark).not.toHaveBeenCalled();
      act(() => show("visible"));
      expect(mockMark).toHaveBeenCalledTimes(1);
      expect(mockMark).toHaveBeenCalledWith({ realm: "eurth" });
    });

    it("does not mark a waiting message when the tab was hidden by the time it was due", () => {
      const { result } = renderHook(() => useRealmBoardRead("eurth", true));
      act(() => result.current.markSeen("p1"));
      act(() => result.current.markSeen("p2"));
      show("hidden");
      act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
      expect(mockMark).toHaveBeenCalledTimes(1);
      act(() => show("visible"));
      expect(mockMark).toHaveBeenCalledTimes(2);
    });
  });
});
