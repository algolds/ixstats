/** The suggest-a-card article search: a failed search says so and offers a retry, never "no articles found". */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArticleSearch } from "~/components/cards/suggest/ArticleSearch";

const fetchPages = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: { useUtils: () => ({ wikios: { searchPages: { fetch: fetchPages } } }) },
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
});
