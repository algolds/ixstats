import { act, renderHook } from "@testing-library/react";

const mockSuggestions = jest.fn((_input: { q: string }, _options: object) => ({
  data: undefined as object[] | undefined,
  isFetching: false,
}));
const mockAuth = { isSignedIn: true };
jest.mock("~/trpc/react", () => ({
  api: {
    thinkpagesForum: {
      mentionSuggestions: {
        useQuery: (input: { q: string }, options: object) => mockSuggestions(input, options),
      },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: null, isSignedIn: mockAuth.isSignedIn }),
}));
const mockDebounce = jest.fn(<T,>(value: T, _delay?: number) => value);
jest.mock("~/hooks/useDebounce", () => ({
  useDebounce: <T,>(value: T, delay?: number) => mockDebounce(value, delay),
}));

import { useMentionSource } from "~/components/thinkpages-forum/composer/useMentionSource";

const lastOptions = () => mockSuggestions.mock.calls.at(-1)![1] as { enabled: boolean };
const lastInput = () => mockSuggestions.mock.calls.at(-1)![0];

beforeEach(() => {
  mockSuggestions.mockReset();
  mockSuggestions.mockReturnValue({ data: undefined, isFetching: false });
  mockDebounce.mockClear();
  mockAuth.isSignedIn = true;
});

describe("useMentionSource", () => {
  it("asks nothing until two valid characters are typed", () => {
    const { result } = renderHook(() => useMentionSource());
    expect(lastOptions().enabled).toBe(false);
    act(() => result.current.onQueryChange("k"));
    expect(lastOptions().enabled).toBe(false);
    act(() => result.current.onQueryChange("ki r"));
    expect(lastOptions().enabled).toBe(false);
    act(() => result.current.onQueryChange("x".repeat(25)));
    expect(lastOptions().enabled).toBe(false);
  });

  it("asks for the lower-cased name without the @ once it is usable", () => {
    const { result } = renderHook(() => useMentionSource());
    act(() => result.current.onQueryChange("@Ki"));
    expect(lastInput()).toEqual({ q: "ki" });
    expect(lastOptions().enabled).toBe(true);
  });

  it("asks nothing for a signed-out visitor", () => {
    mockAuth.isSignedIn = false;
    const { result } = renderHook(() => useMentionSource());
    act(() => result.current.onQueryChange("ki"));
    expect(lastOptions().enabled).toBe(false);
  });

  it("returns the answer as the menu's items, and none while the query is not usable", () => {
    const items = [{ kind: "user", name: "kirsten", label: "kirsten", avatarUrl: null }];
    mockSuggestions.mockReturnValue({ data: items, isFetching: false });
    const { result } = renderHook(() => useMentionSource());
    expect(result.current.items).toEqual([]);
    act(() => result.current.onQueryChange("ki"));
    expect(result.current.items).toEqual(items);
    act(() => result.current.onQueryChange(""));
    expect(result.current.items).toEqual([]);
  });

  it("shows only the latest query's answer when the query changes", () => {
    const answers: Record<string, object[]> = {
      ki: [{ kind: "user", name: "kirsten", label: "kirsten", avatarUrl: null }],
      kir: [{ kind: "user", name: "kirill", label: "kirill", avatarUrl: null }],
    };
    mockSuggestions.mockImplementation(({ q }) => ({ data: answers[q], isFetching: false }));
    const { result } = renderHook(() => useMentionSource());
    act(() => result.current.onQueryChange("ki"));
    expect(result.current.items).toEqual(answers.ki);
    act(() => result.current.onQueryChange("kir"));
    expect(result.current.items).toEqual(answers.kir);
    act(() => result.current.onQueryChange("k"));
    expect(result.current.items).toEqual([]);
  });

  it("debounces the query by 200 ms", () => {
    renderHook(() => useMentionSource());
    expect(mockDebounce).toHaveBeenCalledWith("", 200);
  });
});
