/** The one wiki importer: find a category's pages, preselect the ones with no card, queue them as one import. */
import "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { useNotify: () => notify };
});

import { api } from "~/trpc/react";
import { WikiImporter } from "~/app/admin/cards/imports/WikiImporter";
const mutate = jest.fn();

interface Callbacks {
  onSuccess: (result: object, input: object) => void;
  onError: (error: Error) => void;
}

/** The crawl answers through `crawl`, settling the mutation's callbacks as tRPC would. */
function serve(crawl: jest.Mock) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { imports: { jobs: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(api.cards.admin.imports.crawl.useMutation).mockImplementation(((
    callbacks: Callbacks
  ) => ({
    isPending: false,
    mutate: (input: object) =>
      void (crawl(input) as Promise<object>).then(
        (result) => callbacks.onSuccess(result, input),
        (error: Error) => callbacks.onError(error)
      ),
  })) as never);
  jest.mocked(api.cards.admin.imports.start.useMutation).mockReturnValue({
    mutate,
    isPending: false,
  } as never);
}

const findCategory = (name: string) => {
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Find pages" }));
};

beforeEach(() => jest.clearAllMocks());

describe("WikiImporter", () => {
  it("finds a category's pages, preselects the ones with no card, and queues them", async () => {
    const crawl = jest.fn().mockResolvedValue({
      entries: [
        { title: "Union Assembly", carded: false },
        { title: "Elm", carded: true },
      ],
      truncated: false,
    });
    serve(crawl);

    render(<WikiImporter />);
    findCategory("Category: Elm");

    await waitFor(() => expect(screen.getByText("Union Assembly")).toBeInTheDocument());
    expect(crawl).toHaveBeenCalledWith({
      source: "ixwiki",
      mode: "category",
      category: "Elm",
      titles: undefined,
    });
    expect(screen.getByText("2 pages found · 1 already has a card")).toBeInTheDocument();
    expect(screen.getByText("Has a card")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Elm Has a card" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Import 1 page" }));
    expect(mutate).toHaveBeenCalledWith({
      source: "ixwiki",
      label: "Category:Elm",
      titles: ["Union Assembly"],
    });
  });

  it("imports only the pages left checked", async () => {
    serve(
      jest.fn().mockResolvedValue({
        entries: [
          { title: "Ash", carded: false },
          { title: "Birch", carded: false },
        ],
        truncated: false,
      })
    );
    render(<WikiImporter />);
    findCategory("Trees");
    await waitFor(() => expect(screen.getByText("Ash")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: "Ash" }));
    fireEvent.click(screen.getByRole("button", { name: "Import 1 page" }));
    expect(mutate).toHaveBeenCalledWith({
      source: "ixwiki",
      label: "Category:Trees",
      titles: ["Birch"],
    });
  });

  it("checks a pasted list of titles, and labels its import as chosen pages", async () => {
    const crawl = jest.fn().mockResolvedValue({
      entries: [{ title: "Oak", carded: false }],
      truncated: false,
    });
    serve(crawl);
    render(<WikiImporter />);
    fireEvent.click(screen.getByRole("radio", { name: "A list" }));
    fireEvent.change(screen.getByLabelText("Page titles, one per line"), {
      target: { value: " Oak \n\nElm_land\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find pages" }));
    await waitFor(() => expect(screen.getByText("Oak")).toBeInTheDocument());
    expect(crawl).toHaveBeenCalledWith({
      source: "ixwiki",
      mode: "titles",
      category: undefined,
      titles: ["Oak", "Elm_land"],
    });
    fireEvent.click(screen.getByRole("button", { name: "Import 1 page" }));
    expect(mutate).toHaveBeenCalledWith({
      source: "ixwiki",
      label: "Chosen pages",
      titles: ["Oak"],
    });
  });
});
