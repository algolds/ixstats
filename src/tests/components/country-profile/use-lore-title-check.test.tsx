/**
 * The lore writer's live title check: a title is checked once it has stayed still, never while a check is running,
 * and a failed check says so instead of passing the title as free.
 */
import { act, renderHook } from "@testing-library/react";
import { useLoreTitleCheck } from "~/hooks/lore/useLoreTitleCheck";

interface Answer {
  data?: { exists: boolean; resolvedTitle: string };
  isFetching: boolean;
  isError: boolean;
}

let mockAnswer: Answer;
const mockQuery = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      checkPageExists: {
        useQuery: (input: { title: string }, options: { enabled: boolean }) => {
          mockQuery(input, options);
          return options.enabled ? mockAnswer : { isFetching: false, isError: false };
        },
      },
    },
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockQuery.mockClear();
  mockAnswer = {
    data: { exists: false, resolvedTitle: "Venceia" },
    isFetching: false,
    isError: false,
  };
});

afterEach(() => jest.useRealTimers());

function settle() {
  act(() => {
    jest.advanceTimersByTime(400);
  });
}

describe("useLoreTitleCheck", () => {
  it("is still checking while the title is being typed, and checks it once it stays still", () => {
    const { result, rerender } = renderHook(({ title }) => useLoreTitleCheck(title), {
      initialProps: { title: "" },
    });
    expect(result.current).toEqual({ status: "empty" });

    rerender({ title: "Venceia" });
    expect(result.current).toEqual({ status: "checking" });
    expect(mockQuery).toHaveBeenLastCalledWith(
      { title: "" },
      expect.objectContaining({ enabled: false })
    );

    settle();
    expect(mockQuery).toHaveBeenLastCalledWith(
      { title: "Venceia" },
      expect.objectContaining({ enabled: true })
    );
    expect(result.current).toEqual({ status: "free", title: "Venceia" });
  });

  it("never passes a newly typed title on the last title's answer", () => {
    const { result, rerender } = renderHook(({ title }) => useLoreTitleCheck(title), {
      initialProps: { title: "Venceia" },
    });
    settle();
    expect(result.current).toEqual({ status: "free", title: "Venceia" });

    rerender({ title: "Venceia Nova" });
    expect(result.current).toEqual({ status: "checking" });
  });

  it("is checking while a check runs, even with an earlier answer", () => {
    mockAnswer = { ...mockAnswer, isFetching: true };
    const { result } = renderHook(() => useLoreTitleCheck("Venceia"));
    settle();
    expect(result.current).toEqual({ status: "checking" });
  });

  it("is checking until the first answer comes", () => {
    mockAnswer = { isFetching: false, isError: false };
    const { result } = renderHook(() => useLoreTitleCheck("Venceia"));
    settle();
    expect(result.current).toEqual({ status: "checking" });
  });

  it("says a failed check failed", () => {
    mockAnswer = { isFetching: false, isError: true };
    const { result } = renderHook(() => useLoreTitleCheck("Venceia"));
    settle();
    expect(result.current).toEqual({ status: "failed" });
  });

  it("names the page an existing title leads to", () => {
    mockAnswer = { ...mockAnswer, data: { exists: true, resolvedTitle: "Venceia (city)" } };
    const { result } = renderHook(() => useLoreTitleCheck("venceia"));
    settle();
    expect(result.current).toEqual({
      status: "exists",
      title: "Venceia",
      resolvedTitle: "Venceia (city)",
    });
  });

  it("never asks about a title the wiki would refuse", () => {
    const { result } = renderHook(() => useLoreTitleCheck("Venceia|City"));
    settle();
    expect(result.current).toEqual({ status: "invalid" });
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: true })
    );
  });
});
