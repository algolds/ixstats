import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { getDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";

type SaveProps = {
  title: string;
  initialWikitext: string;
  registerContentReader?: (read: (() => string | null) | null) => void;
  restoreLocalDraft?: boolean;
  onSave: (content: string, summary: string, minor: boolean, keepEditing?: boolean) => Promise<void>;
};

const mockSave = jest.fn();
const mockRefetch = jest.fn();
const mockInvalidate = jest.fn();
const mockNotifySuccess = jest.fn();
const mockNotifyError = jest.fn();
const mockVisual = jest.fn();
const mockSource = jest.fn();
const mockSourceMounted = jest.fn();
let mockPage: { wikitext: string; revisionRef: string | null; revisionRefs?: string[] } = { wikitext: "", revisionRef: null };
/** What the open editor holds right now (null: still what it was opened with). */
let mockEditorContent: string | null = null;
let mockFetchedAfterMount = true;
const mockUseQuery = jest.fn();

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<React.ComponentType<Record<string, unknown>>>) =>
    function Lazy(props: Record<string, unknown>) {
      const [Loaded, setLoaded] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
      React.useEffect(() => {
        void loader().then((component) => setLoaded(() => component));
      }, []);
      return Loaded ? <Loaded {...props} /> : null;
    },
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getWikitext: { invalidate: (...args: unknown[]) => mockInvalidate(...args) } } }),
    wikios: {
      getWikitext: {
        useQuery: (...args: unknown[]) => {
          mockUseQuery(...args);
          return {
            data: mockPage,
            isLoading: false,
            isFetchedAfterMount: mockFetchedAfterMount,
            refetch: () => mockRefetch(),
          };
        },
      },
      saveWikitext: { useMutation: () => ({ mutateAsync: (...args: unknown[]) => mockSave(...args) }) },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
  }),
}));
/**
 * The real visual editor starts from a local draft of the page when it finds one (and is not told
 * otherwise); the stub does the same against the REAL draft store, so a draft that survives the
 * bridge's "Load current version" shows up as the editor's text.
 */
jest.mock("~/components/wiki-os/editor/WikiVisualEditor", () => ({
  WikiVisualEditor: (props: SaveProps) => {
    mockVisual(props);
    const { getDraft: readDraft } = jest.requireActual("~/lib/wiki-os/editor/draft-store");
    const draft = props.restoreLocalDraft === false ? null : readDraft(props.title, "ixwiki");
    React.useEffect(() => {
      props.registerContentReader?.(() => mockEditorContent ?? draft?.wikitext ?? props.initialWikitext);
      return () => props.registerContentReader?.(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.registerContentReader]);
    return <div data-testid="visual">{draft?.wikitext ?? props.initialWikitext}</div>;
  },
}));
jest.mock("~/components/wiki-os/editor/WikiSourceEditor", () => ({
  WikiSourceEditor: (props: SaveProps) => {
    mockSource(props);
    React.useEffect(() => mockSourceMounted(), []);
    React.useEffect(() => {
      props.registerContentReader?.(() => mockEditorContent ?? props.initialWikitext);
      return () => props.registerContentReader?.(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.registerContentReader]);
    return <div data-testid="source">{props.initialWikitext}</div>;
  },
}));

const lastVisualProps = (): SaveProps => mockVisual.mock.calls.at(-1)![0] as SaveProps;
const lastSourceProps = (): SaveProps => mockSource.mock.calls.at(-1)![0] as SaveProps;

async function openEditor(): Promise<void> {
  render(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} onSaveSuccess={onSaveSuccess} />);
  await screen.findByTestId("source");
}

const onClose = jest.fn();
const onSaveSuccess = jest.fn();

const conflictResult = (currentRevisionRef: string | null, currentWikitext = "Their text") => ({
  success: false,
  editConflict: true,
  currentWikitext,
  currentRevisionRef,
});

async function save(content: string, keepEditing = false): Promise<unknown> {
  let outcome: unknown = "saved";
  await act(async () => {
    try {
      await lastSourceProps().onSave(content, "summary", false, keepEditing);
    } catch (error) {
      outcome = error;
    }
  });
  return outcome;
}

describe("WikiEditBridge edit conflicts and drafts (WK-2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A conflict is logged by the bridge on purpose; keep the test output readable.
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.clear();
    mockPage = { wikitext: "Server text", revisionRef: "rev-1" };
    mockEditorContent = null;
    mockFetchedAfterMount = true;
    mockSave.mockResolvedValue({ success: true, title: "Vesperia", revisionId: "rev-9" });
    mockRefetch.mockResolvedValue({ data: { wikitext: "Saved text", revisionRef: "rev-9" } });
  });

  it("sends the revision the page was loaded at as the base of a save", async () => {
    await openEditor();
    expect(lastSourceProps().initialWikitext).toBe("Server text");

    await save("My text");

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Vesperia", wikitext: "My text", baseRevisionRef: "rev-1" })
    );
    expect(onSaveSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalledWith({ title: "Vesperia" });
  });

  it("sends no base for a page that did not exist", async () => {
    mockPage = { wikitext: "", revisionRef: null };
    await openEditor();
    await save("First text");
    expect(mockSave.mock.calls[0]![0].baseRevisionRef).toBeUndefined();
  });

  it("keeps the author's text, shows the banner and does not close on a conflict", async () => {
    mockSave.mockResolvedValueOnce(conflictResult("rev-2"));
    await openEditor();

    expect(await save("My text")).toBeInstanceOf(Error);

    expect(await screen.findByText(/Edit Conflict Detected/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load current version" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save anyway" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // the editor was not remounted: the author's text is still in it
    expect(mockSourceMounted).toHaveBeenCalledTimes(1);
  });

  it("'Save anyway' saves the same text on top of the current revision", async () => {
    mockSave.mockResolvedValueOnce(conflictResult("rev-2"));
    await openEditor();
    mockEditorContent = "My text";
    await save("My text");

    fireEvent.click(await screen.findByRole("button", { name: "Save anyway" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1]![0]).toEqual(
      expect.objectContaining({ wikitext: "My text", baseRevisionRef: "rev-2" })
    );
    expect(mockNotifySuccess).toHaveBeenCalled();
    expect(screen.queryByText(/Edit Conflict Detected/)).toBeNull();
  });

  it("'Load current version' reloads the editor on the current text, and saves against the new revision", async () => {
    mockSave.mockResolvedValueOnce(conflictResult("rev-2", "Their text"));
    await openEditor();
    await save("My text");

    fireEvent.click(await screen.findByRole("button", { name: "Load current version" }));

    await waitFor(() => expect(lastSourceProps().initialWikitext).toBe("Their text"));
    expect(mockSourceMounted).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Edit Conflict Detected/)).toBeNull();
    // the author's text is not a draft any more: the current version must not be shadowed by it
    expect(getDraft("Vesperia")).toBeNull();

    await save("Merged text");
    expect(mockSave.mock.calls[1]![0]).toEqual(
      expect.objectContaining({ wikitext: "Merged text", baseRevisionRef: "rev-2" })
    );
  });

  it("builds the next save of a session on the revision the last one created", async () => {
    await openEditor();
    await save("First", true);
    await save("Second", true);

    expect(mockSave.mock.calls[0]![0].baseRevisionRef).toBe("rev-1");
    expect(mockSave.mock.calls[1]![0].baseRevisionRef).toBe("rev-9");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("restores a draft that is based on the revision now published", async () => {
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "source", wikitext: "Draft text", baseRevisionRef: "rev-1" });
    await openEditor();
    expect(lastSourceProps().initialWikitext).toBe("Draft text");
    expect(screen.queryByText(/Older draft found/)).toBeNull();
  });

  it("does not silently replace fresher server text with an older draft", async () => {
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "source", wikitext: "Old draft", baseRevisionRef: "rev-0" });
    render(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);

    expect(await screen.findByText(/Older draft found/)).toBeTruthy();
    expect(mockSource).not.toHaveBeenCalled();
    expect(mockVisual).not.toHaveBeenCalled();
    expect(getDraft("Vesperia")?.wikitext).toBe("Old draft");

    fireEvent.click(screen.getByRole("button", { name: "Use current version" }));
    await screen.findByTestId("source");
    expect(lastSourceProps().initialWikitext).toBe("Server text");
    expect(getDraft("Vesperia")).toBeNull();
  });

  it("does not raise the older-draft question for a draft that equals the published text", async () => {
    // The visual editor writes a draft of what it just published; it must not greet the next edit.
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "source", wikitext: "Server text", baseRevisionRef: undefined });
    await openEditor();
    expect(screen.queryByText(/Older draft found/)).toBeNull();
    expect(lastSourceProps().initialWikitext).toBe("Server text");
  });

  it("treats a draft with no recorded base as older than a page that has a revision", async () => {
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "source", wikitext: "Legacy draft", baseRevisionRef: undefined });
    render(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);
    expect(await screen.findByText(/Older draft found/)).toBeTruthy();
  });

  it("restores an older draft on request and then checks a save against the draft's own base", async () => {
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "source", wikitext: "Old draft", baseRevisionRef: "rev-0" });
    mockSave.mockResolvedValueOnce(conflictResult("rev-1", "Server text"));
    render(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);

    fireEvent.click(await screen.findByRole("button", { name: "Restore my draft" }));
    await screen.findByTestId("source");
    expect(lastSourceProps().initialWikitext).toBe("Old draft");

    expect(await save("Old draft, edited")).toBeInstanceOf(Error);
    expect(mockSave.mock.calls[0]![0].baseRevisionRef).toBe("rev-0");
    expect(await screen.findByText(/Edit Conflict Detected/)).toBeTruthy();
  });

  it("stamps drafts written by any editor with the revision the editor was loaded from", async () => {
    await openEditor();
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "source", wikitext: "In progress" });
    expect(getDraft("Vesperia")?.baseRevisionRef).toBe("rev-1");
  });

  it("'Save anyway' sends what is in the editor NOW, not what the conflicting save sent", async () => {
    mockSave.mockResolvedValueOnce(conflictResult("rev-2"));
    await openEditor();
    await save("Text at the time of the conflict");

    mockEditorContent = "Text after the author kept editing";
    fireEvent.click(await screen.findByRole("button", { name: "Save anyway" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSave.mock.calls[1]![0]).toEqual(
      expect.objectContaining({
        wikitext: "Text after the author kept editing",
        baseRevisionRef: "rev-2",
      })
    );
  });

  it("opens an editor on a fresh fetch: no cache, refetch on mount, and no editor until it arrived", async () => {
    mockFetchedAfterMount = false;
    const view = render(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Vesperia" },
      expect.objectContaining({ staleTime: 0, refetchOnMount: "always" })
    );
    expect(screen.queryByTestId("source")).toBeNull();

    mockFetchedAfterMount = true;
    view.rerender(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);
    expect(await screen.findByTestId("source")).toBeTruthy();
  });

  describe("'Load current version' against the real draft store", () => {
    async function conflictWithDraft(mode: "source" | "visual"): Promise<void> {
      mockSave.mockResolvedValueOnce(conflictResult("rev-2", "Their text"));
      render(<WikiEditBridge title="Vesperia" initialMode={mode} onClose={onClose} />);
      await screen.findByTestId(mode);
      // The author's own draft of the page exists while they edit (Save draft, or an earlier session).
      saveDraft({ title: "Vesperia", source: "ixwiki", mode, wikitext: "My stale draft" });
      mockEditorContent = "My text";
      await act(async () => {
        try {
          await (mode === "source" ? lastSourceProps() : lastVisualProps()).onSave("My text", "s", false);
        } catch {
          /* the conflict is the point */
        }
      });
      fireEvent.click(await screen.findByRole("button", { name: "Load current version" }));
    }

    it.each(["source", "visual"] as const)("%s mode: clears the page's draft and opens on the current text", async (mode) => {
      await conflictWithDraft(mode);

      await waitFor(() => expect(screen.getByTestId(mode).textContent).toBe("Their text"));
      expect(getDraft("Vesperia")).toBeNull();
      expect(window.localStorage.length).toBe(0);
    });

    it("keeps the author's text in the component: 'Restore my text' puts it back into the editor", async () => {
      await conflictWithDraft("visual");
      await screen.findByText(/Your version was set aside/);
      expect(getDraft("Vesperia")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Restore my text" }));

      await waitFor(() => expect(screen.getByTestId("visual").textContent).toBe("My text"));
      expect(screen.queryByText(/Your version was set aside/)).toBeNull();
      // and it does not come back as a draft
      expect(getDraft("Vesperia")).toBeNull();
    });

    it("'Copy my version' puts the author's text on the clipboard", async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      await conflictWithDraft("source");

      fireEvent.click(await screen.findByRole("button", { name: "Copy my version" }));

      expect(writeText).toHaveBeenCalledWith("My text");
      await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith("Copied", expect.any(String)));
    });

    it("drops the set-aside text after a successful save", async () => {
      await conflictWithDraft("source");
      await screen.findByText(/Your version was set aside/);
      await save("Merged");
      expect(screen.queryByText(/Your version was set aside/)).toBeNull();
    });
  });

  it("starts the visual editor without restoring a draft itself: the bridge decides", async () => {
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "visual", wikitext: "Server text", baseRevisionRef: "rev-1" });
    render(<WikiEditBridge title="Vesperia" initialMode="visual" onClose={onClose} />);
    await screen.findByTestId("visual");
    expect(lastVisualProps().restoreLocalDraft).toBe(false);
  });
});
