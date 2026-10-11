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

const flush = () => act(async () => void (await Promise.resolve()));

describe("useRealmBoardRead", () => {
  it("marks the board read at once for the first message seen, and refreshes the counts", async () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    expect(mockMark).toHaveBeenCalledWith({ realm: "eurth" });
    await flush();
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("marks once for the same newest message", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    act(() => result.current.markSeen("p1"));
    expect(mockMark).toHaveBeenCalledTimes(1);
  });

  it("holds back messages that arrive inside the interval and marks once when it ends", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    act(() => {
      jest.advanceTimersByTime(2_000);
      result.current.markSeen("p2");
      jest.advanceTimersByTime(2_000);
      result.current.markSeen("p3");
      jest.advanceTimersByTime(2_000);
      result.current.markSeen("p4");
    });
    expect(mockMark).toHaveBeenCalledTimes(1);
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS - 6_000 - 1));
    expect(mockMark).toHaveBeenCalledTimes(1);
    act(() => void jest.advanceTimersByTime(1));
    expect(mockMark).toHaveBeenCalledTimes(2);
    // The next message after the held one waits out a new interval from that mark.
    act(() => result.current.markSeen("p5"));
    expect(mockMark).toHaveBeenCalledTimes(2);
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    expect(mockMark).toHaveBeenCalledTimes(3);
  });

  it("marks straight away again once the interval has passed", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    act(() => result.current.markSeen("p2"));
    expect(mockMark).toHaveBeenCalledTimes(2);
  });

  it("marks nothing for a signed-out reader", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", false));
    act(() => result.current.markSeen("p1"));
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS * 2));
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("tries the same message again after a failed mark", async () => {
    mockMark.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    await flush();
    expect(mockInvalidate).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    act(() => result.current.markSeen("p1"));
    expect(mockMark).toHaveBeenCalledTimes(2);
  });

  it("drops a waiting mark when the page goes away", () => {
    const { result, unmount } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    act(() => result.current.markSeen("p2"));
    unmount();
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS * 2));
    expect(mockMark).toHaveBeenCalledTimes(1);
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

  it("does not hold the new realm back for the old realm's interval", () => {
    const { result, rerender } = renderHook(({ slug }) => useRealmBoardRead(slug, true), {
      initialProps: { slug: "eurth" },
    });
    act(() => result.current.markSeen("p1"));
    act(() => void jest.advanceTimersByTime(1_000));
    rerender({ slug: "kiro" });
    act(() => result.current.markSeen("p9"));
    expect(mockMark).toHaveBeenLastCalledWith({ realm: "kiro" });
    expect(mockMark).toHaveBeenCalledTimes(2);
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

  it("still marks a waiting message when the reader leaves the top and comes back before the interval ends", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current.markSeen("p1"));
    act(() => result.current.markSeen("p2"));
    act(() => result.current.leaveTop());
    act(() => void jest.advanceTimersByTime(3_000));
    act(() => result.current.markSeen("p3"));
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    expect(mockMark).toHaveBeenCalledTimes(2);
  });
});
