import { renderHook } from "@testing-library/react";
import { messageUnreadTotal, useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";

const mockUseQuery = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    messages: {
      getFolderCounts: {
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
      },
    },
  },
}));

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user_1" } }),
}));

describe("messageUnreadTotal", () => {
  it("counts inbox once, since it already includes the per-source counts", () => {
    expect(
      messageUnreadTotal({ inbox: 5, thinktank: 2, diplomatic: 1, wiki: 1, forum: 1, requests: 0 })
    ).toBe(5);
  });

  it("adds pending message requests, which inbox leaves out", () => {
    expect(messageUnreadTotal({ inbox: 3, requests: 2 })).toBe(5);
  });

  it("is zero without data", () => {
    expect(messageUnreadTotal(undefined)).toBe(0);
  });
});

describe("useMessageUnreadCount", () => {
  it("queries the shared no-argument key with the nav badge options and sums the total", () => {
    mockUseQuery.mockReturnValue({
      data: { inbox: 4, thinktank: 2, diplomatic: 0, wiki: 0, forum: 0, requests: 1 },
      refetch: jest.fn(),
    });
    const { result } = renderHook(() => useMessageUnreadCount());

    expect(mockUseQuery).toHaveBeenCalledWith(undefined, {
      enabled: true,
      staleTime: 15_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    });
    expect(result.current.totalUnread).toBe(5);
    expect(result.current.hasUnread).toBe(true);
  });
});
