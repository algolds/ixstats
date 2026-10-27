/**
 * The suggest-a-card article search: a failed search says so and offers a retry, never "no articles found"; a new
 * query clears the error at once, an answer to an older search is dropped, and a pending search is cancelled when the
 * wiki changes or the field unmounts.
 */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArticleSearch } from "~/components/cards/suggest/ArticleSearch";

const fetchPages = jest.fn();

// One utils object for every render, as tRPC's useUtils gives.
const utils = { wikios: { searchPages: { fetch: fetchPages } } };

jest.mock("~/trpc/react", () => ({
  api: { useUtils: () => utils },
}));

function typeQuery(query: string) {
  render(<ArticleSearch id="a" wikiSource="ixwiki" onSelect={jest.fn()} />);
  const input = screen.getByRole("textbox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
}

beforeEach(() => {
  fetchPages.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ArticleSearch", () => {
  it("shows an error with a retry when the search fails, not an empty result", async () => {
    fetchPages.mockRejectedValueOnce(new Error("down"));
    typeQuery("Caphiria");

    expect(await screen.findByRole("alert", {}, { timeout: 2000 })).toHaveTextContent(
      /Could not search .* articles/
    );
    expect(screen.queryByText(/No articles found/)).toBeNull();

    fetchPages.mockResolvedValueOnce([{ title: "Caphiria" }]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Caphiria", { selector: "*:not(input)" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchPages).toHaveBeenCalledTimes(2);
    expect(fetchPages).toHaveBeenLastCalledWith({ query: "Caphiria", limit: 10, wiki: "ixwiki" });
  });

  it("says no articles were found when the search succeeds empty", async () => {
    fetchPages.mockResolvedValueOnce([]);
    typeQuery("Nowhere");

    await waitFor(() => expect(screen.getByText(/No articles found/)).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("with the debounce timer", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    const settle = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
        await Promise.resolve();
      });
    };

    it("clears the error as soon as a new query is typed, before its search runs", async () => {
      fetchPages.mockRejectedValueOnce(new Error("down"));
      typeQuery("Caphiria");
      await settle(500);
      expect(screen.getByRole("alert")).toHaveTextContent(/Could not search/);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Caphiria Imperium" } });

      expect(screen.queryByRole("alert")).toBeNull();
      expect(fetchPages).toHaveBeenCalledTimes(1);
    });

    it("drops a slow failure for an older query instead of letting it replace the newer results", async () => {
      let failFirst: (reason: Error) => void = () => undefined;
      fetchPages.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failFirst = reject;
          })
      );
      typeQuery("Caphiria");
      await settle(500);

      fetchPages.mockResolvedValueOnce([{ title: "Urcea" }]);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Urcea" } });
      await settle(500);
      expect(screen.getByText("Urcea", { selector: "*:not(input)" })).toBeInTheDocument();

      await act(async () => {
        failFirst(new Error("slow outage"));
        await Promise.resolve();
      });

      expect(screen.getByText("Urcea", { selector: "*:not(input)" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("cancels the pending search when the wiki changes, so only the new wiki is searched", async () => {
      fetchPages.mockResolvedValue([]);
      const { rerender } = render(
        <ArticleSearch id="a" wikiSource="ixwiki" onSelect={jest.fn()} />
      );
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Caphiria" } });
      await settle(200);

      rerender(<ArticleSearch id="a" wikiSource="iiwiki" onSelect={jest.fn()} />);
      await settle(500);

      expect(fetchPages).toHaveBeenCalledTimes(1);
      expect(fetchPages).toHaveBeenCalledWith({ query: "Caphiria", limit: 10, wiki: "iiwiki" });
    });

    it("cancels the pending search on unmount", async () => {
      typeQuery("Caphiria");
      cleanup();
      await settle(1000);

      expect(fetchPages).not.toHaveBeenCalled();
    });
  });
});
