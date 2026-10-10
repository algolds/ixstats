import { renderHook } from "@testing-library/react";
import type { ActionCardData } from "~/components/action-links";

interface QueryState {
  data?: ActionCardData[];
  isSuccess?: boolean;
  isError?: boolean;
}
type Input = { ids: string[] };

/** One query state per chunk the hook asks for, by its ids. */
const cards = jest.fn<QueryState, [Input]>();
jest.mock("~/trpc/react", () => ({
  api: {
    useQueries: (
      queries: (t: { actionLinks: { activityCards: (input: Input) => Input } }) => Input[],
      opts: { combine: (results: QueryState[]) => unknown }
    ) =>
      opts.combine(
        queries({ actionLinks: { activityCards: (input) => input } }).map((input) => ({
          isSuccess: false,
          isError: false,
          ...cards(input),
        }))
      ),
  },
}));

import { useThreadActionCards } from "~/hooks/useThreadActionCards";

function card(id: string, title: string): ActionCardData {
  return { id, title, type: "diplomatic", createdAt: new Date(0), country: null };
}

beforeEach(() => cards.mockReset());

describe("useThreadActionCards", () => {
  it("queries every id from 3 posts in one call and returns a Map", () => {
    cards.mockReturnValue({ data: [card("a1", "A"), card("b2", "B")], isSuccess: true });
    const posts = [
      { contentHtml: "<p>x</p>[ixaction=a1]" },
      { contentHtml: "[ixaction=b2] and [ixaction=a1]" },
      { contentHtml: "[ixaction=c3]" },
    ];
    const { result } = renderHook(() => useThreadActionCards(posts));
    expect(cards).toHaveBeenCalledTimes(1);
    expect(cards).toHaveBeenCalledWith({ ids: ["a1", "b2", "c3"] });
    expect(result.current.cards.get("b2")?.title).toBe("B");
    expect(result.current.cards.has("c3")).toBe(false);
    expect(result.current).toMatchObject({ ready: true, errored: false });
  });

  it("asks nothing when no post has a token, and is ready", () => {
    const { result } = renderHook(() => useThreadActionCards([{ contentHtml: "<p>none</p>" }]));
    expect(cards).not.toHaveBeenCalled();
    expect(result.current.cards.size).toBe(0);
    expect(result.current.ready).toBe(true);
  });

  it("is not ready while loading and reports a failed request", () => {
    const posts = [{ contentHtml: "[ixaction=a1]" }];
    cards.mockReturnValue({});
    expect(renderHook(() => useThreadActionCards(posts)).result.current).toMatchObject({
      ready: false,
      errored: false,
    });
    cards.mockReturnValue({ isError: true });
    expect(renderHook(() => useThreadActionCards(posts)).result.current).toMatchObject({
      ready: false,
      errored: true,
    });
  });

  it("ignores tokens inside tags and attribute values: only text renders a card (I7)", () => {
    cards.mockReturnValue({ data: [], isSuccess: true });
    const posts = [
      {
        contentHtml:
          '<p title="[ixaction=attr1]">[ixaction=text1]</p><a href="#[ixaction=attr2]">x</a>',
      },
    ];
    renderHook(() => useThreadActionCards(posts));
    expect(cards).toHaveBeenCalledWith({ ids: ["text1"] });
  });

  it("asks for more than 50 ids in chunks of the router's maximum, all of them (I7)", () => {
    cards.mockImplementation(({ ids }) => ({
      data: ids.map((id) => card(id, id)),
      isSuccess: true,
    }));
    const posts = [
      { contentHtml: Array.from({ length: 120 }, (_, i) => `[ixaction=id${i}]`).join(" ") },
    ];
    const { result } = renderHook(() => useThreadActionCards(posts));
    expect(cards.mock.calls.map(([input]) => input.ids.length)).toEqual([50, 50, 20]);
    expect(result.current.cards.size).toBe(120);
    expect(result.current.ready).toBe(true);
  });

  it("is ready only when every chunk has settled, and errored when any failed", () => {
    const posts = [
      { contentHtml: Array.from({ length: 60 }, (_, i) => `[ixaction=id${i}]`).join(" ") },
    ];
    cards.mockReturnValueOnce({ data: [], isSuccess: true }).mockReturnValueOnce({ isError: true });
    expect(renderHook(() => useThreadActionCards(posts)).result.current).toMatchObject({
      ready: false,
      errored: true,
    });
  });
});
