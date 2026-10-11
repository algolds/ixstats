import { act, renderHook, waitFor } from "@testing-library/react";

const mockMark = jest.fn();
const mockRefresh = jest.fn(() => Promise.resolve());
jest.mock("~/trpc/react", () => ({
  api: { thinkpagesForum: { markThreadRead: { useMutation: () => ({ mutateAsync: mockMark }) } } },
}));
jest.mock("~/components/thinkpages-forum/useReadStateRefresh", () => ({
  // A new function every render, as a refreshed utils object would give: the effect runs again with the same key.
  useReadStateRefresh: () => () => mockRefresh(),
}));

import { useMarkThreadRead } from "~/components/thinkpages-forum/thread/useMarkThreadRead";

beforeEach(() => {
  mockMark.mockReset();
  mockMark.mockResolvedValue({ readAt: new Date() });
  mockRefresh.mockClear();
});

const args = { threadId: "t1", page: 2, signedIn: true, newestPostId: "p40" as string | undefined };

describe("useMarkThreadRead", () => {
  it("marks the page the reader is shown, then refreshes the lists and counts", async () => {
    renderHook(() => useMarkThreadRead(args));
    await waitFor(() => expect(mockMark).toHaveBeenCalledWith({ threadId: "t1", page: 2 }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it("marks once per thread, page and newest post, and again when a newer post is the last one shown", async () => {
    const { rerender } = renderHook((props) => useMarkThreadRead(props), { initialProps: args });
    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
    rerender(args);
    expect(mockMark).toHaveBeenCalledTimes(1);
    rerender({ ...args, newestPostId: "p41" });
    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(2));
    rerender({ ...args, newestPostId: "p41", page: 3 });
    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(3));
  });

  it("marks nothing for a signed-out reader or before any post is shown", () => {
    renderHook(() => useMarkThreadRead({ ...args, signedIn: false }));
    renderHook(() => useMarkThreadRead({ ...args, newestPostId: undefined }));
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("keeps marking after a failed mark", async () => {
    mockMark.mockRejectedValueOnce(new Error("offline"));
    const { rerender } = renderHook((props) => useMarkThreadRead(props), { initialProps: args });
    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
    expect(mockRefresh).not.toHaveBeenCalled();
    rerender({ ...args, newestPostId: "p41" });
    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(2));
  });

  it("does not retry a failed mark on a re-render with the same key", async () => {
    mockMark.mockRejectedValueOnce(new Error("offline"));
    const { rerender } = renderHook((props) => useMarkThreadRead(props), { initialProps: args });
    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
    rerender({ ...args });
    rerender({ ...args });
    await act(async () => void (await Promise.resolve()));
    expect(mockMark).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("does not report a failed refresh after a saved mark", async () => {
    mockRefresh.mockRejectedValueOnce(new Error("offline"));
    renderHook(() => useMarkThreadRead(args));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockMark).toHaveBeenCalledTimes(1);
  });
});
