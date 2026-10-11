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
    act(() => result.current("p1"));
    expect(mockMark).toHaveBeenCalledWith({ realm: "eurth" });
    await flush();
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("marks once for the same newest message", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current("p1"));
    act(() => result.current("p1"));
    expect(mockMark).toHaveBeenCalledTimes(1);
  });

  it("holds back messages that arrive inside the interval and marks once when it ends", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current("p1"));
    act(() => {
      jest.advanceTimersByTime(2_000);
      result.current("p2");
      jest.advanceTimersByTime(2_000);
      result.current("p3");
      jest.advanceTimersByTime(2_000);
      result.current("p4");
    });
    expect(mockMark).toHaveBeenCalledTimes(1);
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS - 6_000 - 1));
    expect(mockMark).toHaveBeenCalledTimes(1);
    act(() => void jest.advanceTimersByTime(1));
    expect(mockMark).toHaveBeenCalledTimes(2);
    // The next message after the held one waits out a new interval from that mark.
    act(() => result.current("p5"));
    expect(mockMark).toHaveBeenCalledTimes(2);
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    expect(mockMark).toHaveBeenCalledTimes(3);
  });

  it("marks straight away again once the interval has passed", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current("p1"));
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    act(() => result.current("p2"));
    expect(mockMark).toHaveBeenCalledTimes(2);
  });

  it("marks nothing for a signed-out reader", () => {
    const { result } = renderHook(() => useRealmBoardRead("eurth", false));
    act(() => result.current("p1"));
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS * 2));
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("tries the same message again after a failed mark", async () => {
    mockMark.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current("p1"));
    await flush();
    expect(mockInvalidate).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS));
    act(() => result.current("p1"));
    expect(mockMark).toHaveBeenCalledTimes(2);
  });

  it("drops a waiting mark when the page goes away", () => {
    const { result, unmount } = renderHook(() => useRealmBoardRead("eurth", true));
    act(() => result.current("p1"));
    act(() => result.current("p2"));
    unmount();
    act(() => void jest.advanceTimersByTime(BOARD_READ_INTERVAL_MS * 2));
    expect(mockMark).toHaveBeenCalledTimes(1);
  });
});
