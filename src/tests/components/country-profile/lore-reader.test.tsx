/**
 * The Lore tab: the country's wiki article as WikiOS renders it, without its infobox, beside WikiOS's contents. A
 * nation of another wiki (an Eurth nation on IIWiki) reads its own wiki's page. Native lore (plan Task 5): the pieces
 * follow the article as chapters, the index lists them by type after the article's chapters, and only owner and
 * co-authors get "Write lore" (the owner also "Add an existing page"). An unreachable wiki never blanks the tab.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { LoreReader } from "~/components/country-profile/lore/LoreReader";

interface Answer {
  data?: {
    title: string;
    contentHtml: string;
    infoboxHtml: string | null;
    toc: { id: string; text: string; level: number }[];
  };
  isLoading: boolean;
  error: { data: { code: string } } | null;
}

interface Piece {
  title: string;
  type: "person" | "place" | "event" | "organisation" | "other";
  pinned: boolean;
}

let answer: Answer;
const useQuery = jest.fn((_input: { title: string }, _options: object) => ({
  ...answer,
  refetch: jest.fn(),
}));
let country: { name: string; wikiSource: string | null; wikiPageTitle: string | null };
let mockAccess: { enabled: boolean; isOwner: boolean; canWrite: boolean } | undefined;
let mockPieces: { data?: Piece[]; isError: boolean };
const mockWriter = jest.fn();
const mockAddExisting = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("~/styles/wiki-os.css", () => ({}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ countryLore: { list: { invalidate: mockInvalidate } } }),
    countryLore: {
      access: { useQuery: () => ({ data: mockAccess }) },
      list: { useQuery: () => mockPieces },
      setCuration: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
      addExisting: { useMutation: () => ({ mutateAsync: mockAddExisting, isPending: false }) },
    },
    wikios: {
      getArticleHtml: {
        useQuery: (input: { title: string }, options: object) => useQuery(input, options),
      },
    },
  },
}));
// The writer is Task 4's (lore-writer.test.tsx); here only how the tab mounts it.
jest.mock("~/components/country-profile/lore/LoreWriter", () => ({
  LoreWriter: (props: { open: boolean; countryName: string }) => {
    mockWriter(props);
    return props.open ? <div role="dialog" aria-label={`Writer for ${props.countryName}`} /> : null;
  },
}));
jest.mock("~/app/countries/[slug]/_components/ProfileShellContext", () => ({
  useProfileShell: () => ({ country }),
}));

// WikiOS's scroll spy remeasures on resize; jsdom has no ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
  unobserve() {}
};

const layer = {
  countryId: "c_caph",
  identity: { name: "Caphiria" },
} as unknown as CountryProfileLayer;

const ARTICLE = {
  title: "Caphiria",
  contentHtml:
    '<p>Caphiria is a republic.</p><h2 id="History">History</h2><p>Founded in 480 BC.</p><h2 id="Geography">Geography</h2><p>Spans Sarpedon.</p>',
  infoboxHtml: '<table class="infobox"><tr><td>Capital: Venceia</td></tr></table>',
  toc: [
    { id: "History", text: "History", level: 2 },
    { id: "Geography", text: "Geography", level: 2 },
  ],
};

const VISITOR = { enabled: true, isOwner: false, canWrite: false };
const CO_AUTHOR = { enabled: true, isOwner: false, canWrite: true };
const OWNER = { enabled: true, isOwner: true, canWrite: true };

const PIECES: Piece[] = [
  { title: "Venceia", type: "place", pinned: false },
  { title: "Constantinus I", type: "person", pinned: false },
];

const lastWriter = () => mockWriter.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  useQuery.mockClear();
  mockWriter.mockClear();
  mockAddExisting.mockReset().mockResolvedValue({ title: "Venceia" });
  mockInvalidate.mockClear();
  answer = { data: ARTICLE, isLoading: false, error: null };
  country = { name: "Caphiria", wikiSource: "ixwiki", wikiPageTitle: "Caphiria" };
  mockAccess = VISITOR;
  mockPieces = { data: [], isError: false };
  // Pieces read once their chapter nears the viewport; this jsdom has no IntersectionObserver, so they read at once.
  // @ts-expect-error: a browser without the API
  delete globalThis.IntersectionObserver;
});

describe("LoreReader", () => {
  it("shows the article as WikiOS renders it, in WikiOS's article styles, without its infobox", () => {
    const { container } = render(<LoreReader layer={layer} />);
    expect(screen.getByText("Founded in 480 BC.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "History" })).toBeInTheDocument();
    expect(container.querySelector(".wikios-article-content .mw-parser-output")).not.toBeNull();
    expect(screen.queryByText("Capital: Venceia")).toBeNull();
  });

  it("lists the article's sections in WikiOS's contents", () => {
    render(<LoreReader layer={layer} />);
    const contents = screen.getByRole("complementary", { name: "Contents" });
    expect(
      within(contents)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["History", "Geography"]);
  });

  it("opens and edits the article on WikiOS", () => {
    render(<LoreReader layer={layer} />);
    expect(screen.getByRole("link", { name: "Open in WikiOS" })).toHaveAttribute(
      "href",
      "/wiki/Caphiria"
    );
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });

  it("reads an Eurth nation's page from IIWiki, which WikiOS does not edit", () => {
    country = { name: "Afropa", wikiSource: "iiwiki", wikiPageTitle: "Afropan Republic" };
    answer = { ...answer, data: { ...ARTICLE, title: "Afropan Republic" } };
    render(<LoreReader layer={layer} />);
    expect(useQuery.mock.calls[0]?.[0]).toEqual({
      title: "Afropan Republic",
      wikiSource: "iiwiki",
    });
    expect(screen.getByRole("link", { name: "Open in WikiOS" })).toHaveAttribute(
      "href",
      "/wiki/Afropan_Republic?source=iiwiki"
    );
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });

  it("offers to write the article when there is none", () => {
    answer = { isLoading: false, error: { data: { code: "NOT_FOUND" } } };
    render(<LoreReader layer={layer} />);
    expect(screen.getByText("No wiki article yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create page on WikiOS" })).toBeInTheDocument();
  });

  it("says the wiki could not be loaded instead of offering to write a page that may exist", () => {
    answer = { isLoading: false, error: { data: { code: "BAD_GATEWAY" } } };
    render(<LoreReader layer={layer} />);
    expect(screen.getByText("The wiki could not be loaded")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create page on WikiOS" })).toBeNull();
  });

  describe("native lore", () => {
    it("lists the article's chapters in the index, then the pieces by type", () => {
      mockPieces = { data: PIECES, isError: false };
      render(<LoreReader layer={layer} />);
      const contents = screen.getByRole("complementary", { name: "Contents" });
      expect(
        within(contents)
          .getAllByRole("link")
          .map((link) => link.textContent)
      ).toEqual(["History", "Geography", "Constantinus I", "Venceia"]);
      const pieces = within(contents).getByRole("navigation", { name: "Lore pieces" });
      expect(
        within(pieces)
          .getAllByRole("heading")
          .map((h) => h.textContent)
      ).toEqual(["People", "Places"]);
      expect(within(pieces).getByRole("link", { name: "Venceia" })).toHaveAttribute(
        "href",
        "#lore-piece-Venceia"
      );
    });

    it("jumps to a piece's chapter from the index", () => {
      mockPieces = { data: PIECES, isError: false };
      const scrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      render(<LoreReader layer={layer} />);
      const pieces = screen.getByRole("navigation", { name: "Lore pieces" });
      // The jump scrolls in place: the link does not follow its #anchor (the tab keeps its own address).
      expect(fireEvent.click(within(pieces).getByRole("link", { name: "Venceia" }))).toBe(false);
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
      expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("lore-piece-Venceia"));
    });

    it("leaves out the article's contents when it has a single chapter", () => {
      answer = { ...answer, data: { ...ARTICLE, toc: [ARTICLE.toc[0]!] } };
      render(<LoreReader layer={layer} />);
      expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
    });

    it("lists no chapters of an article that has nothing to show", () => {
      answer = { ...answer, data: { ...ARTICLE, contentHtml: "" } };
      render(<LoreReader layer={layer} />);
      expect(screen.getByText("The wiki could not be loaded")).toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
    });

    it("asks again for a lean article this page cannot resolve, and waits for it", () => {
      const refetch = jest.fn();
      useQuery.mockImplementationOnce(() => ({
        ...answer,
        data: {
          ...ARTICLE,
          contentHtml: "wikios-lean:123e4567-e89b-12d3-a456-426614174000:body",
        },
        refetch,
      }));
      render(<LoreReader layer={layer} />);
      expect(screen.getByRole("status", { name: "Loading lore" })).toBeInTheDocument();
      expect(refetch).toHaveBeenCalled();
    });

    it("shows an index of pieces even for an article without chapters", () => {
      answer = { ...answer, data: { ...ARTICLE, toc: [] } };
      mockPieces = { data: PIECES, isError: false };
      render(<LoreReader layer={layer} />);
      expect(screen.getByRole("complementary", { name: "Contents" })).toBeInTheDocument();
    });

    it("has no index for an article without chapters and no pieces", () => {
      answer = { ...answer, data: { ...ARTICLE, toc: [] } };
      render(<LoreReader layer={layer} />);
      expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
    });

    it("reads the pieces as chapters after the article", () => {
      mockPieces = { data: PIECES, isError: false };
      render(<LoreReader layer={layer} />);
      expect(screen.getByRole("region", { name: "Venceia" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Places" })).toBeInTheDocument();
      expect(useQuery).toHaveBeenCalledWith({ title: "Venceia" }, expect.anything());
    });

    it("offers a visitor no way to write", () => {
      mockPieces = { data: PIECES, isError: false };
      render(<LoreReader layer={layer} />);
      expect(screen.queryByRole("button", { name: "Write lore" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Add an existing page" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
      expect(lastWriter()).toEqual(expect.objectContaining({ open: false }));
    });

    it("lets a co-author write lore and edit a piece in the one writer, but not add pages", () => {
      mockAccess = CO_AUTHOR;
      mockPieces = { data: PIECES, isError: false };
      render(<LoreReader layer={layer} />);
      expect(screen.queryByRole("button", { name: "Add an existing page" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Write lore" }));
      expect(screen.getByRole("dialog", { name: "Writer for Caphiria" })).toBeInTheDocument();
      expect(lastWriter()).toEqual(
        expect.objectContaining({ countryId: "c_caph", countryName: "Caphiria", open: true })
      );
      expect(lastWriter().seed).toBeUndefined();
      expect(lastWriter().editTitle).toBeUndefined();
      act(() => (lastWriter().onClose as () => void)());
      expect(lastWriter()).toEqual(expect.objectContaining({ open: false }));

      const venceia = within(screen.getByRole("region", { name: "Venceia" }));
      fireEvent.click(venceia.getByRole("button", { name: "Edit" }));
      expect(lastWriter()).toEqual(expect.objectContaining({ open: true, editTitle: "Venceia" }));
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
    });

    it("lets the owner add an existing page by title and type", async () => {
      mockAccess = OWNER;
      render(<LoreReader layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: "Add an existing page" }));
      const dialog = screen.getByRole("dialog", { name: "Add an existing page" });
      const add = within(dialog).getByRole("button", { name: "Add to the Lore tab" });
      expect(add).toBeDisabled();
      fireEvent.click(within(dialog).getByRole("radio", { name: "Place" }));
      expect(add).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText("Page title"), {
        target: { value: " Venceia " },
      });
      fireEvent.click(add);
      await waitFor(() =>
        expect(mockAddExisting).toHaveBeenCalledWith({
          countryId: "c_caph",
          title: "Venceia",
          type: "place",
        })
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mockInvalidate).toHaveBeenCalledWith({ countryId: "c_caph" });
    });

    it("shows the server's refusal of an existing page and keeps the dialog open", async () => {
      mockAccess = OWNER;
      mockAddExisting.mockRejectedValue(
        Object.assign(new Error("No wiki page has that title."), { data: { code: "NOT_FOUND" } })
      );
      render(<LoreReader layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: "Add an existing page" }));
      const dialog = screen.getByRole("dialog", { name: "Add an existing page" });
      fireEvent.change(within(dialog).getByLabelText("Page title"), { target: { value: "Nope" } });
      fireEvent.click(within(dialog).getByRole("radio", { name: "Other" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Add to the Lore tab" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "No wiki page has that title."
      );
      expect(screen.getByRole("dialog", { name: "Add an existing page" })).toBeInTheDocument();
    });

    it("clears a refusal when the owner tries again", async () => {
      mockAccess = OWNER;
      mockAddExisting
        .mockRejectedValueOnce(
          Object.assign(new Error("No wiki page has that title."), { data: { code: "NOT_FOUND" } })
        )
        .mockReturnValueOnce(new Promise(() => {}));
      render(<LoreReader layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: "Add an existing page" }));
      const dialog = screen.getByRole("dialog", { name: "Add an existing page" });
      fireEvent.change(within(dialog).getByLabelText("Page title"), { target: { value: "Nope" } });
      fireEvent.click(within(dialog).getByRole("radio", { name: "Other" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Add to the Lore tab" }));
      await within(dialog).findByRole("alert");
      fireEvent.click(within(dialog).getByRole("button", { name: "Add to the Lore tab" }));
      await waitFor(() => expect(within(dialog).queryByRole("alert")).toBeNull());
    });

    it("forgets a refusal when the dialog is closed and opened again", async () => {
      mockAccess = OWNER;
      mockAddExisting.mockRejectedValue(
        Object.assign(new Error("No wiki page has that title."), { data: { code: "NOT_FOUND" } })
      );
      render(<LoreReader layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: "Add an existing page" }));
      let dialog = screen.getByRole("dialog", { name: "Add an existing page" });
      fireEvent.change(within(dialog).getByLabelText("Page title"), { target: { value: "Nope" } });
      fireEvent.click(within(dialog).getByRole("radio", { name: "Other" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Add to the Lore tab" }));
      await within(dialog).findByRole("alert");
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Add an existing page" }));
      dialog = screen.getByRole("dialog", { name: "Add an existing page" });
      expect(within(dialog).queryByRole("alert")).toBeNull();
      expect(within(dialog).getByLabelText("Page title")).toHaveValue("");
    });

    it("still offers writing and reads the pieces when the wiki article could not be loaded", () => {
      mockAccess = CO_AUTHOR;
      mockPieces = { data: PIECES, isError: false };
      answer = { isLoading: false, error: { data: { code: "BAD_GATEWAY" } } };
      render(<LoreReader layer={layer} />);
      expect(screen.getByText("The wiki could not be loaded")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Write lore" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Venceia" })).toBeInTheDocument();
    });

    it("still reads the article when the pieces could not be listed, and says so", () => {
      mockPieces = { isError: true };
      render(<LoreReader layer={layer} />);
      expect(screen.getByText("Founded in 480 BC.")).toBeInTheDocument();
      expect(screen.getByText("The lore pieces could not be loaded.")).toBeInTheDocument();
    });

    it("has no actions at all for a visitor when the article could not be loaded", () => {
      answer = { isLoading: false, error: { data: { code: "BAD_GATEWAY" } } };
      render(<LoreReader layer={layer} />);
      expect(screen.queryByRole("group", { name: "Lore actions" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Open in WikiOS" })).toBeNull();
    });

    it("keeps the owner's Add an existing page when the article could not be loaded", () => {
      mockAccess = { enabled: true, isOwner: true, canWrite: false };
      answer = { isLoading: false, error: { data: { code: "BAD_GATEWAY" } } };
      render(<LoreReader layer={layer} />);
      expect(screen.getByRole("button", { name: "Add an existing page" })).toBeInTheDocument();
    });

    it("keeps writing open while the article loads", () => {
      mockAccess = CO_AUTHOR;
      answer = { isLoading: true, error: null };
      render(<LoreReader layer={layer} />);
      expect(screen.getByRole("status", { name: "Loading lore" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Write lore" })).toBeInTheDocument();
    });
  });
});
