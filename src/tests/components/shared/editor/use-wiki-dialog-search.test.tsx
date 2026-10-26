/**
 * The composer's wiki dialog searches every wiki for what is typed in its title field: once typing pauses (300 ms),
 * for at most 200 characters (the search's own limit), and not again for the result just picked.
 */
import { act, renderHook } from "@testing-library/react";
import {
  WIKI_DIALOG_SEARCH_DELAY,
  useWikiDialogSearch,
} from "~/components/shared/editor/useWikiDialogSearch";

interface SearchCall {
  input: { query: string; limit: number; wikiSource: string };
  options: { enabled: boolean };
}
const calls: SearchCall[] = [];

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      search: {
        useQuery: (input: SearchCall["input"], options: SearchCall["options"]) => {
          calls.push({ input, options });
          return { data: undefined, isLoading: false };
        },
      },
    },
  },
}));

/** The searches the dialog actually sends, as their queries. */
const sent = () => calls.filter((c) => c.options.enabled).map((c) => c.input.query);
const last = () => calls[calls.length - 1]!;

beforeEach(() => {
  calls.length = 0;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function setup(initial: string, open = true) {
  const setTarget = jest.fn();
  const setSource = jest.fn();
  const hook = renderHook(
    ({ target, isOpen }: { target: string; isOpen: boolean }) =>
      useWikiDialogSearch({ target, open: isOpen, setTarget, setSource }),
    { initialProps: { target: initial, isOpen: open } }
  );
  return { ...hook, setTarget, setSource };
}

describe("useWikiDialogSearch", () => {
  it("searches all wikis only once typing pauses for 300 ms, for the last thing typed", () => {
    expect(WIKI_DIALOG_SEARCH_DELAY).toBe(300);
    const { rerender } = setup("");
    for (const typed of ["G", "Ga", "Gal", "Gall"]) {
      rerender({ target: typed, isOpen: true });
      act(() => jest.advanceTimersByTime(100));
    }
    expect(sent()).toEqual([]);
    act(() => jest.advanceTimersByTime(199));
    expect(sent()).toEqual([]);
    act(() => jest.advanceTimersByTime(1));
    expect(sent()).toEqual(["Gall"]);
    expect(last().input).toEqual({ query: "Gall", limit: 5, wikiSource: "all" });
  });

  it("trims the query and sends nothing for one character", () => {
    const { rerender } = setup("");
    rerender({ target: "  Ga  ", isOpen: true });
    act(() => jest.advanceTimersByTime(300));
    expect(last().input.query).toBe("Ga");
    rerender({ target: " G ", isOpen: true });
    act(() => jest.advanceTimersByTime(300));
    expect(last().options.enabled).toBe(false);
  });

  it("clamps a long title to the search's 200 characters", () => {
    const { rerender } = setup("");
    rerender({ target: "x".repeat(450), isOpen: true });
    act(() => jest.advanceTimersByTime(300));
    expect(last().input.query).toBe("x".repeat(200));
    expect(last().options.enabled).toBe(true);
  });

  it("sends nothing while the dialog is closed", () => {
    setup("Gallambria", false);
    act(() => jest.advanceTimersByTime(300));
    expect(sent()).toEqual([]);
  });

  it("picking a result sets the title and its wiki, and does not search for it again", () => {
    const { result, rerender, setTarget, setSource } = setup("");
    rerender({ target: "Gall", isOpen: true });
    act(() => jest.advanceTimersByTime(300));
    act(() => result.current.selectResult({ title: "Gallambria Republic", source: "iiwiki" }));
    expect(setTarget).toHaveBeenCalledWith("Gallambria Republic");
    expect(setSource).toHaveBeenCalledWith("iiwiki");
    rerender({ target: "Gallambria Republic", isOpen: true });
    act(() => jest.advanceTimersByTime(300));
    expect(last().options.enabled).toBe(false);
    // typing on from the pick searches again
    rerender({ target: "Gallambria Republic history", isOpen: true });
    act(() => jest.advanceTimersByTime(300));
    expect(last().options.enabled).toBe(true);
    expect(last().input.query).toBe("Gallambria Republic history");
  });
});
