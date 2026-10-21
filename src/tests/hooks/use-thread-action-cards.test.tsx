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
});
