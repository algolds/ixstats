/**
 * Native lore plan Task 5: the Lore tab's pieces. Each piece is a chapter, grouped by type, read inline in WikiOS's
 * article styles once its chapter nears the viewport (a long list never fetches every page up front). Everyone may
 * open a piece in WikiOS; owner and co-authors may edit it; only the owner pins and hides. A piece that fails to
 * render says so in its own chapter and the others still read.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LorePieces } from "~/components/country-profile/lore/LorePieces";
import type { LoreListedPiece } from "~/lib/lore/lore-groups";

interface ArticleAnswer {
  data?: { title: string; contentHtml: string; toc: [] };
  isLoading: boolean;
  error: { data: { code: string } } | null;
}

const mockArticle = jest.fn();
let mockAnswers: Record<string, ArticleAnswer>;
const mockSetCuration = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("~/styles/wiki-os.css", () => ({}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ countryLore: { list: { invalidate: mockInvalidate } } }),
    countryLore: {
      setCuration: {
        useMutation: () => ({ mutateAsync: mockSetCuration }),
      },
    },
    wikios: {
      getArticleHtml: {
        useQuery: (input: { title: string }, options: { enabled?: boolean }) => {
          mockArticle(input, options);
          if (options.enabled === false)
            return { isLoading: false, error: null, refetch: jest.fn() };
          return {
            ...(mockAnswers[input.title] ?? { isLoading: true, error: null }),
            refetch: jest.fn(),
          };
        },
      },
    },
  },
}));

// ── IntersectionObserver: jsdom has none; the test decides when a chapter nears the viewport. ──
let observers: { callback: IntersectionObserverCallback; elements: Element[] }[] = [];
class MockIntersectionObserver {
  private entry: { callback: IntersectionObserverCallback; elements: Element[] };
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, elements: [] };
    observers.push(this.entry);
  }
  observe(element: Element) {
    this.entry.elements.push(element);
  }
  disconnect() {
    observers = observers.filter((o) => o !== this.entry);
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

/** The chapters of these titles near the viewport. */
function nearView(...titles: string[]) {
  act(() => {
    for (const observer of [...observers]) {
      const entries = observer.elements
        .filter((element) => titles.some((title) => element.textContent?.includes(title)))
        .map(
          (target) => ({ isIntersecting: true, target }) as unknown as IntersectionObserverEntry
        );
      if (entries.length > 0)
        observer.callback(entries, observer as unknown as IntersectionObserver);
    }
  });
}

const page = (title: string, html: string): ArticleAnswer => ({
  data: { title, contentHtml: html, toc: [] },
  isLoading: false,
  error: null,
});

const PIECES: LoreListedPiece[] = [
  { title: "Constantinus I", type: "person", pinned: true },
  { title: "Venceia", type: "place", pinned: false },
  { title: "Senate of Caphiria", type: "organisation", pinned: false },
];

function deferred() {
  let resolve: (value: { title: string }) => void = () => undefined;
  const promise = new Promise<{ title: string }>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const refusal = (code: string, message: string) =>
  Object.assign(new Error(message), { data: { code } });

const chapter = (title: string) => screen.getByRole("region", { name: title });

function renderPieces(
  access: { canWrite: boolean; isOwner: boolean },
  pieces: LoreListedPiece[] = PIECES
) {
  const onEdit = jest.fn();
  render(<LorePieces countryId="c_caph" pieces={pieces} {...access} onEdit={onEdit} />);
  return { onEdit };
}

const VISITOR = { canWrite: false, isOwner: false };
const CO_AUTHOR = { canWrite: true, isOwner: false };
const OWNER = { canWrite: true, isOwner: true };

beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
  mockArticle.mockClear();
  mockSetCuration.mockReset().mockResolvedValue({ title: "x" });
  mockInvalidate.mockClear();
  mockAnswers = {
    "Constantinus I": page("Constantinus I", "<p>Born in Venceia.</p>"),
    Venceia: page("Venceia", '<p>The capital. See <a href="/wiki/Senate">the Senate</a>.</p>'),
    "Senate of Caphiria": page("Senate of Caphiria", "<p>Founded long ago.</p>"),
  };
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_PATH;
});

describe("LorePieces", () => {
  it("groups the pieces by type under People, Places and Organisations, leaving out empty groups", () => {
    renderPieces(VISITOR);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "People",
      "Places",
      "Organisations",
    ]);
    expect(screen.queryByRole("heading", { name: "Events" })).toBeNull();
    expect(chapter("Venceia")).toHaveAttribute("id", "lore-piece-Venceia");
  });

  it("says a piece is pinned", () => {
    renderPieces(VISITOR);
    expect(within(chapter("Constantinus I")).getByText("Pinned")).toBeInTheDocument();
    expect(within(chapter("Venceia")).queryByText("Pinned")).toBeNull();
  });

  it("fetches no page until its chapter nears the viewport", () => {
    renderPieces(VISITOR);
    expect(mockArticle).toHaveBeenCalled();
    expect(mockArticle.mock.calls.every(([, options]) => options.enabled === false)).toBe(true);
    expect(screen.queryByText("Born in Venceia.")).toBeNull();
    expect(screen.queryByText(/could not be loaded/)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();

    nearView("Constantinus I");
    expect(mockArticle).toHaveBeenLastCalledWith(
      { title: "Constantinus I" },
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByText("Born in Venceia.")).toBeInTheDocument();
    expect(screen.queryByText("Founded long ago.")).toBeNull();
  });

  it("waits while the observer reports the chapter still far from view", () => {
    renderPieces(VISITOR);
    act(() => {
      for (const observer of [...observers]) {
        observer.callback(
          observer.elements.map(
            (target) => ({ isIntersecting: false, target }) as unknown as IntersectionObserverEntry
          ),
          observer as unknown as IntersectionObserver
        );
      }
    });
    expect(screen.queryByText("Born in Venceia.")).toBeNull();
  });

  it("stops watching a chapter once it has come near", () => {
    renderPieces(VISITOR, [PIECES[0]!]);
    expect(observers).toHaveLength(1);
    nearView("Constantinus I");
    expect(observers).toHaveLength(0);
  });

  it("keeps a piece once read, even after its chapter scrolls away", () => {
    renderPieces(VISITOR);
    nearView("Venceia");
    act(() => {
      for (const observer of [...observers]) {
        observer.callback(
          observer.elements.map(
            (target) => ({ isIntersecting: false, target }) as unknown as IntersectionObserverEntry
          ),
          observer as unknown as IntersectionObserver
        );
      }
    });
    expect(screen.getByText(/The capital\./)).toBeInTheDocument();
  });

  it("reads every piece at once where the browser has no IntersectionObserver", () => {
    // @ts-expect-error: a browser without the API
    delete globalThis.IntersectionObserver;
    renderPieces(VISITOR);
    expect(screen.getByText("Born in Venceia.")).toBeInTheDocument();
    expect(screen.getByText("Founded long ago.")).toBeInTheDocument();
  });

  it("renders a piece in WikiOS's article styles, with links under the base path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    renderPieces(VISITOR);
    nearView("Venceia");
    const body = within(chapter("Venceia")).getByText(/The capital\./);
    expect(body.closest(".wikios-article-content .mw-parser-output")).not.toBeNull();
    expect(screen.getByRole("link", { name: "the Senate" })).toHaveAttribute(
      "href",
      "/projects/ixstates/wiki/Senate"
    );
  });

  it("scopes a piece's ids, so its footnote points at its own note", () => {
    mockAnswers.Venceia = page(
      "Venceia",
      '<p>Old<sup id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup></p><ol><li id="cite_note-1">A note.</li></ol>'
    );
    renderPieces(VISITOR);
    nearView("Venceia");
    const footnote = within(chapter("Venceia")).getByRole("link", { name: "[1]" });
    expect(footnote).toHaveAttribute("href", "#lore-piece-Venceia-cite_note-1");
    const note = document.getElementById("lore-piece-Venceia-cite_note-1");
    expect(note).toHaveTextContent("A note.");
    expect(chapter("Venceia")).toContainElement(note);
  });

  it("puts a piece's own sections below its title in the heading order", () => {
    mockAnswers.Venceia = page("Venceia", '<h2 id="History">History</h2><p>Old.</p>');
    renderPieces(VISITOR);
    nearView("Venceia");
    const venceia = within(chapter("Venceia"));
    expect(venceia.getByRole("heading", { level: 3, name: "Venceia" })).toBeInTheDocument();
    expect(venceia.getByRole("heading", { level: 4, name: "History" })).toHaveAttribute(
      "id",
      "lore-piece-Venceia-History"
    );
  });

  it("shows a placeholder while a near piece loads", () => {
    mockAnswers.Venceia = { isLoading: true, error: null };
    renderPieces(VISITOR);
    nearView("Venceia");
    expect(within(chapter("Venceia")).getByRole("status")).toHaveAccessibleName("Loading Venceia");
  });

  it("says a piece could not be loaded in its own chapter, and the others still read", () => {
    mockAnswers.Venceia = { isLoading: false, error: { data: { code: "BAD_GATEWAY" } } };
    renderPieces(VISITOR);
    nearView("Venceia", "Senate of Caphiria");
    expect(within(chapter("Venceia")).getByText("This page could not be loaded")).toBeVisible();
    expect(within(chapter("Senate of Caphiria")).getByText("Founded long ago.")).toBeVisible();
    expect(within(chapter("Senate of Caphiria")).queryByText(/could not be loaded/)).toBeNull();
  });

  it("says so too for a page with no content", () => {
    mockAnswers.Venceia = page("Venceia", "");
    renderPieces(VISITOR);
    nearView("Venceia");
    expect(within(chapter("Venceia")).getByText("This page could not be loaded")).toBeVisible();
  });

  it("offers every reader Open in WikiOS, and a visitor nothing else", () => {
    renderPieces(VISITOR);
    const venceia = within(chapter("Venceia"));
    expect(venceia.getByRole("link", { name: "Open in WikiOS" })).toHaveAttribute(
      "href",
      "/wiki/Venceia"
    );
    expect(venceia.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(venceia.queryByRole("button", { name: /Pin|Unpin|Hide/ })).toBeNull();
  });

  it("lets a co-author edit a piece, without the owner's pin and hide", () => {
    const { onEdit } = renderPieces(CO_AUTHOR);
    const venceia = within(chapter("Venceia"));
    fireEvent.click(venceia.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith("Venceia");
    expect(venceia.queryByRole("button", { name: /Pin|Hide/ })).toBeNull();
  });

  it("lets the owner pin and unpin a piece", async () => {
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    await waitFor(() =>
      expect(mockSetCuration).toHaveBeenCalledWith({
        countryId: "c_caph",
        title: "Venceia",
        pinned: true,
      })
    );
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ countryId: "c_caph" }));

    fireEvent.click(within(chapter("Constantinus I")).getByRole("button", { name: "Unpin" }));
    await waitFor(() =>
      expect(mockSetCuration).toHaveBeenLastCalledWith({
        countryId: "c_caph",
        title: "Constantinus I",
        pinned: false,
      })
    );
  });

  it("asks the owner before hiding a piece, and hides it only on confirm", async () => {
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Hide" }));
    const confirm = screen.getByRole("alertdialog", { name: "Hide Venceia from the Lore tab?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep it" }));
    expect(mockSetCuration).not.toHaveBeenCalled();

    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Hide" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide the piece" }));
    await waitFor(() =>
      expect(mockSetCuration).toHaveBeenCalledWith({
        countryId: "c_caph",
        title: "Venceia",
        hidden: true,
      })
    );
  });

  it("holds each piece's pin and hide while its own change is in flight", async () => {
    const venceia = deferred();
    const senate = deferred();
    mockSetCuration.mockReturnValueOnce(venceia.promise).mockReturnValueOnce(senate.promise);
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    fireEvent.click(within(chapter("Senate of Caphiria")).getByRole("button", { name: "Pin" }));
    for (const title of ["Venceia", "Senate of Caphiria"]) {
      expect(within(chapter(title)).getByRole("button", { name: "Pin" })).toBeDisabled();
      expect(within(chapter(title)).getByRole("button", { name: "Hide" })).toBeDisabled();
    }
    expect(within(chapter("Venceia")).getByRole("button", { name: "Edit" })).toBeEnabled();
    expect(within(chapter("Constantinus I")).getByRole("button", { name: "Unpin" })).toBeEnabled();

    await act(async () => venceia.resolve({ title: "Venceia" }));
    expect(within(chapter("Venceia")).getByRole("button", { name: "Pin" })).toBeEnabled();
    expect(
      within(chapter("Senate of Caphiria")).getByRole("button", { name: "Pin" })
    ).toBeDisabled();
    await act(async () => senate.resolve({ title: "Senate of Caphiria" }));
    expect(
      within(chapter("Senate of Caphiria")).getByRole("button", { name: "Pin" })
    ).toBeEnabled();
  });

  it("keeps each piece's own refusal", async () => {
    mockSetCuration
      .mockRejectedValueOnce(refusal("CONFLICT", "Venceia is busy."))
      .mockRejectedValueOnce(refusal("CONFLICT", "The Senate is busy."));
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    await within(chapter("Venceia")).findByRole("alert");
    fireEvent.click(within(chapter("Senate of Caphiria")).getByRole("button", { name: "Pin" }));
    await within(chapter("Senate of Caphiria")).findByRole("alert");
    expect(within(chapter("Venceia")).getByRole("alert")).toHaveTextContent("Venceia is busy.");
    expect(within(chapter("Senate of Caphiria")).getByRole("alert")).toHaveTextContent(
      "The Senate is busy."
    );
  });

  it("keeps one piece's refusal while another piece changes", async () => {
    mockSetCuration
      .mockRejectedValueOnce(refusal("CONFLICT", "Busy."))
      .mockResolvedValueOnce({ title: "Senate of Caphiria" });
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    await within(chapter("Venceia")).findByRole("alert");
    fireEvent.click(within(chapter("Senate of Caphiria")).getByRole("button", { name: "Pin" }));
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalled());
    expect(within(chapter("Venceia")).getByRole("alert")).toHaveTextContent("Busy.");
  });

  it("shows the server's refusal in the piece's chapter only", async () => {
    mockSetCuration.mockRejectedValue(
      refusal("FORBIDDEN", "Only the country's owner can do this.")
    );
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    expect(await within(chapter("Venceia")).findByRole("alert")).toHaveTextContent(
      "Only the country's owner can do this."
    );
    expect(within(chapter("Senate of Caphiria")).queryByRole("alert")).toBeNull();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("does not leak a server error the owner cannot act on", async () => {
    mockSetCuration.mockRejectedValue(refusal("INTERNAL_SERVER_ERROR", "pg: relation missing"));
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    expect(await within(chapter("Venceia")).findByRole("alert")).toHaveTextContent(
      "That could not be changed just now."
    );
  });

  it("clears a refusal on the next change", async () => {
    mockSetCuration.mockRejectedValueOnce(refusal("CONFLICT", "Busy."));
    renderPieces(OWNER);
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    await within(chapter("Venceia")).findByRole("alert");
    fireEvent.click(within(chapter("Venceia")).getByRole("button", { name: "Pin" }));
    await waitFor(() => expect(within(chapter("Venceia")).queryByRole("alert")).toBeNull());
  });

  it("renders nothing for no pieces", () => {
    const { container } = render(
      <LorePieces countryId="c" pieces={[]} canWrite isOwner onEdit={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
