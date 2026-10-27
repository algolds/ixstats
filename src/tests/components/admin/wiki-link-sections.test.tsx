/**
 * C1c (plan 2026-10-25 sister wikis, Task 8): the admin's country wiki link tools carry the wiki. A linked or
 * matched page opens in the WikiOS reader on its own wiki (`?source=`), AltHistory is a source like the others, and a
 * wiki that cannot be reached says so: never "not found" or "no matches".
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";

const mockSearch = jest.fn();
const mockRefetch = jest.fn();
const mockMutateAsync = jest.fn();
const mockMutate = jest.fn();

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      wikios: { searchArticles: { fetch: mockSearch } },
      countries: { getAll: { invalidate: jest.fn() } },
    }),
    wikios: { getIntro: { useQuery: () => ({ refetch: mockRefetch }) } },
    admin: {
      setWikiLink: { useMutation: () => ({ mutate: mockMutate }) },
      bulkSetWikiLinks: { useMutation: () => ({ mutateAsync: mockMutateAsync }) },
    },
  },
}));

import { BulkScannerSection } from "~/app/admin/wiki/components/BulkScannerSection";
import { ManualLinkEditorSection } from "~/app/admin/wiki/components/ManualLinkEditorSection";
import { WikiLinkStatusSection } from "~/app/admin/wiki/components/WikiLinkStatusSection";
import { WIKI_SOURCES } from "~/lib/wiki-os/config";

const outage = (code: string) =>
  new TRPCClientError("could not be reached just now.", {
    result: { error: { message: "", code: -32603, data: { code, httpStatus: 503 } } },
  });

const country = (
  id: string,
  name: string,
  link: { title: string; source: string } | null = null
) => ({
  id,
  name,
  wikiPageTitle: link?.title ?? null,
  wikiSource: link?.source ?? null,
  wikiLastSynced: link ? "2026-10-01T00:00:00Z" : null,
});

beforeEach(() => {
  mockSearch.mockReset();
  mockRefetch.mockReset();
  mockMutateAsync.mockReset().mockResolvedValue({ updated: 1 });
  mockMutate.mockReset();
});

describe("the wiki link status table", () => {
  it("the wiki page cell links to the reader with the source", () => {
    render(
      <WikiLinkStatusSection
        isLoading={false}
        countriesData={{
          countries: [
            country("c1", "Bohemia", { title: "Kingdom of Bohemia", source: "althistory" }),
            country("c2", "Burgundie", { title: "Burgundie", source: "ixwiki" }),
            country("c3", "Avalon", { title: "Avalon", source: "iiwiki" }),
            country("c4", "Nowhere"),
          ],
        }}
      />
    );

    expect(screen.getByRole("link", { name: "Kingdom of Bohemia" })).toHaveAttribute(
      "href",
      "/wiki/Kingdom_of_Bohemia?source=althistory"
    );
    expect(screen.getByRole("link", { name: "Burgundie" })).toHaveAttribute(
      "href",
      "/wiki/Burgundie"
    );
    expect(screen.getByRole("link", { name: "Avalon" })).toHaveAttribute(
      "href",
      "/wiki/Avalon?source=iiwiki"
    );
    expect(screen.getByText(WIKI_SOURCES.althistory.name)).toBeInTheDocument();
    expect(screen.getByText("Not linked")).toBeInTheDocument();
  });
});

describe("the bulk scanner", () => {
  const scan = () =>
    fireEvent.click(screen.getByRole("button", { name: /scan unlinked countries/i }));

  it("the wiki page cell links to the reader with the source, and the link keeps it", async () => {
    mockSearch.mockResolvedValue([{ title: "Kingdom of Bohemia", source: "althistory" }]);
    render(
      <BulkScannerSection countriesData={{ countries: [country("c1", "Kingdom of Bohemia")] }} />
    );
    scan();

    const cell = await screen.findByRole("link", { name: "Kingdom of Bohemia" });
    expect(cell).toHaveAttribute("href", "/wiki/Kingdom_of_Bohemia?source=althistory");

    fireEvent.click(screen.getByRole("button", { name: /link selected/i }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        links: [{ countryId: "c1", wikiPageTitle: "Kingdom of Bohemia", wikiSource: "althistory" }],
      })
    );
  });

  it("an unreachable wiki says could not be reached, not not found", async () => {
    mockSearch
      .mockResolvedValueOnce([{ title: "Avalon", source: "ixwiki" }])
      .mockRejectedValueOnce(outage("SERVICE_UNAVAILABLE"));
    render(
      <BulkScannerSection
        countriesData={{
          countries: [
            country("c1", "Avalon"),
            country("c2", "Burgundie"),
            country("c3", "Caphiria"),
          ],
        }}
      />
    );
    scan();

    expect(
      await screen.findByText(
        `${WIKI_SOURCES.ixwiki.name} could not be reached just now. 2 countries were not scanned. Try again.`
      )
    ).toBeInTheDocument();
    // The scan stops at the outage: the wiki is not asked again for the rest.
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/no wiki matches found/i)).not.toBeInTheDocument();
    // What was found before the outage stays.
    expect(screen.getByRole("link", { name: "Avalon" })).toBeInTheDocument();
  });

  it("a busy wiki is an outage too", async () => {
    mockSearch.mockRejectedValueOnce(outage("TOO_MANY_REQUESTS"));
    render(<BulkScannerSection countriesData={{ countries: [country("c1", "Avalon")] }} />);
    scan();

    expect(
      await screen.findByText(/could not be reached just now\. 1 country was not scanned/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/no wiki matches found/i)).not.toBeInTheDocument();
  });

  it("another failure still reads as no match for that country", async () => {
    mockSearch.mockRejectedValueOnce(outage("INTERNAL_SERVER_ERROR")).mockResolvedValueOnce([]);
    render(
      <BulkScannerSection
        countriesData={{ countries: [country("c1", "Avalon"), country("c2", "Burgundie")] }}
      />
    );
    scan();

    expect(await screen.findByText(/no wiki matches found/i)).toBeInTheDocument();
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/could not be reached/)).not.toBeInTheDocument();
  });
});

describe("the manual link editor", () => {
  const testLink = async (source: "ixwiki" | "iiwiki" | "althistory", title: string) => {
    fireEvent.click(screen.getByRole("radio", { name: WIKI_SOURCES[source].name }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\./), { target: { value: title } });
    fireEvent.click(screen.getByRole("button", { name: "Test link" }));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  };

  it("offers all three wikis", () => {
    render(<ManualLinkEditorSection countriesData={{ countries: [] }} />);
    const group = screen.getByRole("radiogroup", { name: "Wiki source" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => r.textContent)
    ).toEqual((["ixwiki", "iiwiki", "althistory"] as const).map((id) => WIKI_SOURCES[id].name));
  });

  it("an unreachable wiki says could not be reached, not not found", async () => {
    mockRefetch.mockResolvedValue({ data: undefined, error: outage("SERVICE_UNAVAILABLE") });
    render(<ManualLinkEditorSection countriesData={{ countries: [] }} />);
    await testLink("althistory", "Kingdom of Bohemia");

    expect(
      await screen.findByText(
        `${WIKI_SOURCES.althistory.name} could not be reached just now. Try again.`
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/article not found/i)).not.toBeInTheDocument();
  });

  it("a page the wiki does not have is not found", async () => {
    mockRefetch.mockResolvedValue({ data: undefined, error: outage("NOT_FOUND") });
    render(<ManualLinkEditorSection countriesData={{ countries: [] }} />);
    await testLink("iiwiki", "Nowhere");

    expect(
      await screen.findByText("Article not found. Check the title and source.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/could not be reached/)).not.toBeInTheDocument();
  });

  const failedWith = (code: string) => () =>
    mockRefetch.mockResolvedValue({ data: undefined, error: outage(code) });

  it.each([
    ["an internal error", failedWith("INTERNAL_SERVER_ERROR")],
    ["a refused input", failedWith("BAD_REQUEST")],
    ["a refetch that throws", () => mockRefetch.mockRejectedValue(new Error("network"))],
  ])(
    "any other failure (%s) says the link could not be checked, never not found",
    async (_case, fail) => {
      fail();
      render(<ManualLinkEditorSection countriesData={{ countries: [] }} />);
      await testLink("iiwiki", "Caphiria");

      expect(
        await screen.findByText("The link could not be checked. Try again.")
      ).toBeInTheDocument();
      expect(screen.queryByText(/article not found/i)).not.toBeInTheDocument();
    }
  );

  it("a page the wiki reports missing is not found, not article found", async () => {
    mockRefetch.mockResolvedValue({
      data: { title: "Nowhere", intro: "", text: "", source: "iiwiki", missing: true },
      error: null,
    });
    render(<ManualLinkEditorSection countriesData={{ countries: [] }} />);
    await testLink("iiwiki", "Nowhere");

    expect(
      await screen.findByText("Article not found. Check the title and source.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Article found")).not.toBeInTheDocument();
  });

  it("a page with no intro is still found", async () => {
    mockRefetch.mockResolvedValue({
      data: { title: "Stub", intro: "", text: "", source: "ixwiki", missing: false },
      error: null,
    });
    render(<ManualLinkEditorSection countriesData={{ countries: [] }} />);
    await testLink("ixwiki", "Stub");

    expect(await screen.findByText("Article found")).toBeInTheDocument();
  });

  it("a found page shows its intro, and saving keeps the wiki", async () => {
    mockRefetch.mockResolvedValue({
      data: {
        title: "Kingdom of Bohemia",
        intro: "A kingdom.",
        text: "A kingdom.",
        source: "althistory",
        missing: false,
      },
      error: null,
    });
    render(<ManualLinkEditorSection countriesData={{ countries: [country("c1", "Bohemia")] }} />);
    fireEvent.focus(screen.getByPlaceholderText("Search for a country..."));
    fireEvent.click(screen.getByText("Bohemia"));
    await testLink("althistory", "Kingdom of Bohemia");

    expect(await screen.findByText("A kingdom.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));
    expect(mockMutate).toHaveBeenCalledWith({
      countryId: "c1",
      wikiPageTitle: "Kingdom of Bohemia",
      wikiSource: "althistory",
    });
  });
});
