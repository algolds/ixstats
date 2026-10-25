/**
 * Native lore plan Task 4: the lore writer. A full-screen overlay on the country page: the piece's type, then its
 * title (checked live against the wiki) and the type's infobox fields, then WikiOS's editor opened on the generated
 * starting text. A title that exists is caught before the editor opens; a saved piece is recorded on the Lore tab,
 * and a failed record never reads as a failed save. The author's text is never dropped: not on a refused save, not
 * when they go back, close, or carry on in WikiOS.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LoreWriter } from "~/components/country-profile/lore/LoreWriter";
import type { WikitextSerializeResult } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { getDraft } from "~/lib/wiki-os/editor/draft-store";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { DELETED_TITLE, RECORD_FAILED } from "~/lib/lore/writer-messages";

type Reader = (() => string | null) | null;

interface BridgeProps {
  title: string;
  initialMode?: "source" | "visual";
  prefillWikitext?: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
  onSerializedWikitext?: (result: WikitextSerializeResult) => void;
  registerContentReader?: (read: Reader) => void;
  onSaveError?: (error: Error) => void;
}

interface PageCheck {
  exists: boolean;
  resolvedTitle: string;
}

const mockBridge = jest.fn();
/** What the mocked editor holds; null: the text it opened on. */
let mockEditorText: string | null = null;
/** What the mocked canvas adds to the text as it opens (a real canvas may normalise it). */
let mockNormalised = "";
/** Whether the mocked editor reports its serialization (the visual editor does, the source editor does not). */
let mockReports = true;
let mockAccess: { enabled: boolean; isOwner: boolean; canWrite: boolean };
let mockPages: Record<string, PageCheck>;
let mockChecking = false;
const mockRecord = jest.fn();
const mockAddExisting = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("~/styles/wiki-os.css", () => ({}));
// jsdom cannot navigate: a link keeps its href and runs its onClick, and goes nowhere.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, onClick, children }: React.ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: "user_alice", username: null, imageUrl: null },
  }),
}));
jest.mock("~/components/wiki-os/editor/WikiEditBridge", () => ({
  WikiEditBridge: function MockBridge(props: BridgeProps) {
    mockBridge(props);
    React.useEffect(() => {
      const opened = (props.prefillWikitext ?? "") + mockNormalised;
      props.registerContentReader?.(() => mockEditorText ?? opened);
      if (mockReports)
        props.onSerializedWikitext?.({
          wikitext: opened,
          complete: true,
          notices: [],
        });
      return () => props.registerContentReader?.(null);
      // The editor opens once.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="bridge" data-title={props.title} />;
  },
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ countryLore: { list: { invalidate: mockInvalidate } } }),
    countryLore: {
      access: { useQuery: () => ({ data: mockAccess }) },
      recordPiece: { useMutation: () => ({ mutateAsync: mockRecord }) },
      addExisting: { useMutation: () => ({ mutateAsync: mockAddExisting }) },
    },
    wikios: {
      checkPageExists: {
        useQuery: (input: { title: string }, options: { enabled: boolean }) =>
          options.enabled
            ? {
                data: mockChecking
                  ? undefined
                  : (mockPages[input.title] ?? { exists: false, resolvedTitle: input.title }),
                isFetching: mockChecking,
                isError: false,
              }
            : { data: undefined, isFetching: false, isError: false },
      },
    },
  },
}));

const refusal = (code: string, message: string) =>
  Object.assign(new Error(message), { data: { code } });

const lastBridge = (): BridgeProps => mockBridge.mock.calls.at(-1)![0] as BridgeProps;

type WriterProps = Partial<React.ComponentProps<typeof LoreWriter>>;

function renderWriter(props: WriterProps = {}) {
  const onClose = jest.fn();
  render(
    <LoreWriter countryId="c_caph" countryName="Caphiria" open onClose={onClose} {...props} />
  );
  return { onClose };
}

const typeTitle = (title: string) =>
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });

const openEditorButton = () => screen.getByRole("button", { name: "Open the editor" });

/** From the first step: choose `type`, then name the piece `title`. */
function chooseTypeAndTitle(type: string, title: string) {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${type}`) }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  typeTitle(title);
}

function openEditorOn(type: string, title: string) {
  chooseTypeAndTitle(type, title);
  fireEvent.click(openEditorButton());
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockEditorText = null;
  mockNormalised = "";
  mockReports = true;
  mockChecking = false;
  mockAccess = { enabled: true, isOwner: true, canWrite: true };
  mockPages = {};
  mockRecord.mockResolvedValue({ title: "Venceia" });
  mockAddExisting.mockResolvedValue({ title: "Venceia" });
});

describe("LoreWriter: type and title", () => {
  it("is a dialog named for the country, and starts with the four types", () => {
    renderWriter();
    expect(screen.getByRole("dialog", { name: "Write lore for Caphiria" })).toBeInTheDocument();
    const types = within(screen.getByRole("radiogroup", { name: "Lore type" })).getAllByRole(
      "radio"
    );
    expect(types.map((radio) => radio.textContent)).toEqual([
      expect.stringMatching(/^Person/),
      expect.stringMatching(/^Place/),
      expect.stringMatching(/^Event/),
      expect.stringMatching(/^Organisation/),
    ]);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("renders nothing while closed", () => {
    renderWriter({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("catches a title that exists before the editor, and lets the owner add it to the Lore tab", async () => {
    mockPages = { Venceia: { exists: true, resolvedTitle: "Venceia (city)" } };
    const { onClose } = renderWriter();
    chooseTypeAndTitle("Place", "Venceia");

    expect(screen.getByText("A page with this title exists.")).toBeInTheDocument();
    expect(openEditorButton()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add it to the Lore tab" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockAddExisting).toHaveBeenCalledWith({
      countryId: "c_caph",
      title: "Venceia (city)",
      type: "place",
    });
    expect(mockInvalidate).toHaveBeenCalledWith({ countryId: "c_caph" });
    expect(mockBridge).not.toHaveBeenCalled();
  });

  it("shows why adding an existing page failed, and stays open", async () => {
    mockPages = { Venceia: { exists: true, resolvedTitle: "Venceia" } };
    mockAddExisting.mockRejectedValue(
      refusal("FORBIDDEN", "Only the country's owner can do this.")
    );
    const { onClose } = renderWriter();
    chooseTypeAndTitle("Place", "Venceia");
    fireEvent.click(screen.getByRole("button", { name: "Add it to the Lore tab" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the country's owner can do this."
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers a co-author no add, only another title", () => {
    mockAccess = { enabled: true, isOwner: false, canWrite: true };
    mockPages = { Venceia: { exists: true, resolvedTitle: "Venceia" } };
    renderWriter();
    chooseTypeAndTitle("Place", "Venceia");

    expect(screen.getByText("A page with this title exists.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add it to the Lore tab" })).toBeNull();
    expect(screen.getByRole("link", { name: "View the page" })).toHaveAttribute(
      "href",
      "/wiki/Venceia"
    );
  });

  it("does not open the editor while the title is being checked", () => {
    mockChecking = true;
    renderWriter();
    chooseTypeAndTitle("Place", "Venceia");
    expect(openEditorButton()).toBeDisabled();
    expect(screen.getByText("Checking the title")).toBeInTheDocument();
  });

  it.each([
    ["an empty title", "   "],
    ["a title with wiki markup", "Venceia|City"],
    ["a title in another namespace", "User:Venceia"],
    ["a title with a section", "Venceia#History"],
  ])("does not open the editor on %s", (_name, title) => {
    renderWriter();
    chooseTypeAndTitle("Place", title);
    expect(openEditorButton()).toBeDisabled();
  });

  it("explains a title it cannot use", () => {
    renderWriter();
    chooseTypeAndTitle("Place", "User:Venceia");
    expect(screen.getByText(/Use an article title/)).toBeInTheDocument();
  });

  it("goes back to the types from the title", () => {
    renderWriter();
    chooseTypeAndTitle("Person", "Marcus");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /^Person/ })).toHaveAttribute("aria-checked", "true");
  });
});

describe("LoreWriter: the editor", () => {
  it("opens WikiOS's visual editor on a free title with the type's infobox and the lore categories", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");

    const bridge = lastBridge();
    expect(screen.getByTestId("bridge")).toHaveAttribute("data-title", "Venceia");
    expect(bridge.initialMode).toBe("visual");
    expect(bridge.prefillWikitext).toContain("{{Infobox settlement");
    expect(bridge.prefillWikitext).toContain("[[Category:Caphiria lore]]");
    expect(bridge.prefillWikitext).toContain("[[Category:Caphiria]]");
  });

  it("opens on the canonical title", () => {
    renderWriter();
    openEditorOn("Place", "  venceia_city ");
    expect(lastBridge().title).toBe("Venceia city");
  });

  it("fills the infobox from the type's fields", () => {
    renderWriter();
    chooseTypeAndTitle("Organisation", "Senate of Caphiria");
    fireEvent.change(screen.getByLabelText("Founded"), { target: { value: "980" } });
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toMatch(/\{\{Infobox organization[\s\S]*founded\s*= 980/);
  });

  it("writes the point the author types on the Place form", () => {
    renderWriter();
    chooseTypeAndTitle("Place", "Venceia");
    fireEvent.change(screen.getByLabelText("Population"), { target: { value: "2,400,000" } });
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "41.9" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "12.5" } });
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toContain("{{coord|41.9|12.5}}");
    expect(lastBridge().prefillWikitext).toMatch(/population_total\s*= 2,400,000/);
  });

  it("fills an Event's infobox fields", () => {
    renderWriter();
    chooseTypeAndTitle("Event", "Treaty of Venceia");
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Venceia" } });
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toMatch(/location\s*= Venceia/);
  });

  it("fills a Person's infobox fields", () => {
    renderWriter();
    chooseTypeAndTitle("Person", "Marcus");
    fireEvent.change(screen.getByLabelText("Occupation"), { target: { value: "Consul" } });
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toMatch(/\{\{Infobox person[\s\S]*occupation\s*= Consul/);
  });

  it("fills a History seed's date into the Event's date field, and from there the infobox", () => {
    renderWriter({ seed: { type: "event", title: "Treaty of Venceia", date: "1012" } });

    expect(screen.getByLabelText("Title")).toHaveValue("Treaty of Venceia");
    expect(screen.getByLabelText("Date")).toHaveValue("1012");
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toContain("{{Infobox event");
    expect(lastBridge().prefillWikitext).toMatch(/\| date\s*= 1012/);
  });

  it("fills a map seed's point and subdivision into the Place form", () => {
    renderWriter({
      seed: {
        type: "place",
        title: "Venceia",
        place: { lat: 41.9, lng: 12.5, subdivision: "Latium" },
      },
    });
    expect(screen.getByLabelText("Latitude")).toHaveValue(41.9);
    expect(screen.getByLabelText("Subdivision")).toHaveValue("Latium");
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toContain("{{coord|41.9|12.5}}");
  });

  it("writes an Other seed's piece with the category lines only", () => {
    renderWriter({ seed: { type: "other", title: "Notes on Caphiria" } });
    expect(screen.queryByText("For the infobox, all optional")).toBeNull();
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toBe("[[Category:Caphiria lore]]\n[[Category:Caphiria]]");
  });

  it("counts the author's words from the editor's serialization", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    expect(screen.getByText("0 words")).toBeInTheDocument();

    act(() =>
      lastBridge().onSerializedWikitext?.({
        wikitext: "{{Infobox settlement\n| name = Venceia\n}}\nVenceia is old.",
        complete: true,
        notices: [],
      })
    );
    expect(screen.getByText("3 words")).toBeInTheDocument();

    act(() =>
      lastBridge().onSerializedWikitext?.({ wikitext: "Venceia", complete: true, notices: [] })
    );
    expect(screen.getByText("1 word")).toBeInTheDocument();
  });

  it("starts the editor over from the form when the author goes back and changes the type", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("radio", { name: /^Person/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(openEditorButton());

    expect(lastBridge().prefillWikitext).toContain("{{Infobox person");
    expect(lastBridge().prefillWikitext).not.toContain("{{Infobox settlement");

    // The new editor is judged against what it opened on, not the first editor's text.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByText(/Your text from the editor is kept/)).toBeNull();
  });

  it("links Open in WikiOS to the page's editor, without the text in the URL", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    const link = screen.getByRole("link", { name: "Open in WikiOS" });
    expect(link).toHaveAttribute("href", pageEditHref("Venceia", null, { mode: "visual" }));
    expect(link.getAttribute("href")).not.toContain("prefill");
  });

  it("carries a new page's text to WikiOS as the author's draft, even before an edit", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    fireEvent.click(screen.getByRole("link", { name: "Open in WikiOS" }));

    expect(getDraft("user_alice", "Venceia")?.wikitext).toContain("{{Infobox settlement");
  });

  it("carries an existing page's edits to WikiOS, and leaves no draft when nothing changed", () => {
    renderWriter({ editTitle: "Venceia" });
    fireEvent.click(screen.getByRole("link", { name: "Open in WikiOS" }));
    expect(getDraft("user_alice", "Venceia")).toBeNull();

    mockEditorText = "Venceia is older than it looks.";
    fireEvent.click(screen.getByRole("link", { name: "Open in WikiOS" }));
    expect(getDraft("user_alice", "Venceia")?.wikitext).toBe("Venceia is older than it looks.");
  });
});

describe("LoreWriter: saving", () => {
  it("records the saved piece on the Lore tab with its title and type, refreshes the list and closes", async () => {
    const { onClose } = renderWriter();
    openEditorOn("Place", "Venceia");

    act(() => {
      lastBridge().onSaveSuccess?.();
      lastBridge().onClose();
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockRecord).toHaveBeenCalledWith({
      countryId: "c_caph",
      title: "Venceia",
      type: "place",
    });
    expect(mockInvalidate).toHaveBeenCalledWith({ countryId: "c_caph" });
  });

  it("records an Event as an event", async () => {
    renderWriter({ seed: { type: "event", title: "Treaty of Venceia" } });
    fireEvent.click(openEditorButton());
    act(() => lastBridge().onSaveSuccess?.());
    await waitFor(() =>
      expect(mockRecord).toHaveBeenCalledWith({
        countryId: "c_caph",
        title: "Treaty of Venceia",
        type: "event",
      })
    );
  });

  it("says the page is saved when the record fails, and records again on Try again", async () => {
    mockRecord.mockRejectedValueOnce(refusal("TOO_MANY_REQUESTS", "Slow down a little."));
    const { onClose } = renderWriter();
    openEditorOn("Place", "Venceia");
    act(() => {
      lastBridge().onSaveSuccess?.();
      lastBridge().onClose();
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your page is saved.");
    expect(alert).toHaveTextContent("Slow down a little.");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockRecord).toHaveBeenCalledTimes(2);
  });

  it("says something generic when the record fails for another reason", async () => {
    mockRecord.mockRejectedValueOnce(refusal("INTERNAL_SERVER_ERROR", "stack"));
    renderWriter();
    openEditorOn("Place", "Venceia");
    act(() => lastBridge().onSaveSuccess?.());

    expect(await screen.findByRole("alert")).toHaveTextContent(RECORD_FAILED);
    expect(screen.queryByText("stack")).toBeNull();
  });

  it("explains a removed lore category, reopens the saved page to put it back, and records after that save", async () => {
    mockRecord.mockRejectedValueOnce(
      refusal("BAD_REQUEST", "This page is not in Caphiria lore yet.")
    );
    renderWriter();
    openEditorOn("Place", "Venceia");
    act(() => lastBridge().onSaveSuccess?.());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("[[Category:Caphiria lore]]");

    fireEvent.click(screen.getByRole("button", { name: "Edit the page" }));
    expect(lastBridge().title).toBe("Venceia");
    expect(lastBridge().prefillWikitext).toBeUndefined();

    act(() => lastBridge().onSaveSuccess?.());
    await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(2));
  });

  it("closes when the reopened page's editor is cancelled", async () => {
    mockRecord.mockRejectedValueOnce(
      refusal("BAD_REQUEST", "This page is not in Caphiria lore yet.")
    );
    const { onClose } = renderWriter();
    openEditorOn("Place", "Venceia");
    act(() => lastBridge().onSaveSuccess?.());
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Edit the page" }));

    act(() => lastBridge().onClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the record failure, the page staying saved", async () => {
    mockRecord.mockRejectedValueOnce(refusal("TOO_MANY_REQUESTS", "Slow down a little."));
    const { onClose } = renderWriter();
    openEditorOn("Place", "Venceia");
    act(() => lastBridge().onSaveSuccess?.());
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getDraft("user_alice", "Venceia")).toBeNull();
  });

  it("says a refused deleted title belongs to a deleted page, keeping the editor open", () => {
    const { onClose } = renderWriter();
    openEditorOn("Place", "Venceia");
    act(() =>
      lastBridge().onSaveError?.(
        refusal("PRECONDITION_FAILED", "This page was deleted; ask an administrator to restore it")
      )
    );

    expect(screen.getByRole("alert")).toHaveTextContent(DELETED_TITLE);
    expect(screen.getByTestId("bridge")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears a refusal once a later save succeeds", () => {
    renderWriter({ editTitle: "Venceia" });
    act(() => lastBridge().onSaveError?.(refusal("TOO_MANY_REQUESTS", "Slow down a little.")));
    expect(screen.getByRole("alert")).toHaveTextContent("Slow down a little.");
    act(() => lastBridge().onSaveSuccess?.());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the author's text for a new title after a refused save", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    act(() =>
      lastBridge().onSaveError?.(
        refusal("PRECONDITION_FAILED", "This page was deleted; ask an administrator to restore it")
      )
    );
    mockEditorText = "Venceia, my long story.";
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText(/Your text from the editor is kept/)).toBeInTheDocument();
    typeTitle("Venceia Nova");
    fireEvent.click(openEditorButton());
    expect(lastBridge().title).toBe("Venceia Nova");
    expect(lastBridge().prefillWikitext).toBe("Venceia, my long story.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts again from the form when the author lets the kept text go", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    mockEditorText = "Venceia, my long story.";
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(getDraft("user_alice", "Venceia")?.wikitext).toBe("Venceia, my long story.");

    fireEvent.click(screen.getByRole("button", { name: "Start again from the form" }));
    expect(getDraft("user_alice", "Venceia")).toBeNull();
    fireEvent.click(openEditorButton());
    expect(lastBridge().prefillWikitext).toContain("{{Infobox settlement");
  });

  it("counts what the canvas reports after it opened as an edit", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    act(() =>
      lastBridge().onSerializedWikitext?.({ wikitext: "Venceia.", complete: true, notices: [] })
    );
    mockEditorText = "Venceia.";
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(/Your text from the editor is kept/)).toBeInTheDocument();
  });

  it("does not take the canvas's own normalising of the opening text for an edit", () => {
    mockNormalised = "\n";
    renderWriter();
    openEditorOn("Place", "Venceia");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByText(/Your text from the editor is kept/)).toBeNull();
  });

  it("judges an editor that reports no serialization against the text it opened on", () => {
    mockReports = false;
    renderWriter();
    openEditorOn("Place", "Venceia");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByText(/Your text from the editor is kept/)).toBeNull();
  });

  it("keeps nothing when the author goes back without writing", () => {
    renderWriter();
    openEditorOn("Place", "Venceia");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByText(/Your text from the editor is kept/)).toBeNull();
    expect(getDraft("user_alice", "Venceia")).toBeNull();
  });

  it("keeps the author's text as a draft when the writer is closed from the editor", () => {
    const { onClose } = renderWriter();
    openEditorOn("Place", "Venceia");
    mockEditorText = "Venceia, my long story.";
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getDraft("user_alice", "Venceia")?.wikitext).toBe("Venceia, my long story.");
  });

  it("keeps the author's text when the editor's own Cancel closes it", () => {
    const { onClose } = renderWriter();
    openEditorOn("Place", "Venceia");
    mockEditorText = "Venceia, my long story.";
    act(() => lastBridge().onClose());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getDraft("user_alice", "Venceia")?.wikitext).toBe("Venceia, my long story.");
  });
});

describe("LoreWriter: editing a piece", () => {
  it("skips the form and opens the editor on the page, without a prefill", () => {
    renderWriter({ editTitle: "Venceia" });

    expect(screen.getByRole("dialog", { name: "Edit Venceia" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(lastBridge().title).toBe("Venceia");
    expect(lastBridge().prefillWikitext).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("refreshes the Lore tab after a save without recording the piece again, then closes", () => {
    const { onClose } = renderWriter({ editTitle: "Venceia" });
    act(() => {
      lastBridge().onSaveSuccess?.();
      lastBridge().onClose();
    });

    expect(mockRecord).not.toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalledWith({ countryId: "c_caph" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getDraft("user_alice", "Venceia")).toBeNull();
  });

  it("keeps no draft of a saved page when the writer is closed after the save", () => {
    const { onClose } = renderWriter({ editTitle: "Venceia" });
    act(() => lastBridge().onSaveSuccess?.());
    mockEditorText = "Venceia, as saved.";
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getDraft("user_alice", "Venceia")).toBeNull();
  });
});
