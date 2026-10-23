import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { getDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";

type SaveProps = {
  title: string;
  initialWikitext: string;
  registerContentReader?: (read: (() => string | null) | null) => void;
  restoreLocalDraft?: boolean;
  onSave: (
    content: string,
    summary: string,
    minor: boolean,
    keepEditing?: boolean
  ) => Promise<void>;
};

const mockSave = jest.fn();
const mockRefetch = jest.fn();
const mockInvalidate = jest.fn();
const mockNotifySuccess = jest.fn();
const mockNotifyError = jest.fn();
const mockVisual = jest.fn();
const mockSource = jest.fn();
const mockSourceMounted = jest.fn();
let mockPage: { wikitext: string; revisionRef: string | null; revisionRefs?: string[] } = {
  wikitext: "",
  revisionRef: null,
};
/** What the open editor holds right now (null: still what it was opened with). */
let mockEditorContent: string | null = null;
let mockFetchedAfterMount = true;
const mockUseQuery = jest.fn();
let mockUserId: string | null = "user_alice";
let mockAuthLoaded = true;
/** The player's stored passport handle, as `ixnayid.getStatus` reports it. */
let mockHandle: string | null = "alice";
/** The status query has answered (else the gate reads it on the save). */
let mockStatusLoaded = true;
let mockStatusReadFails = false;
const mockSetHandle = jest.fn();
const mockInvalidateStatus = jest.fn();

jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({
    isLoaded: mockAuthLoaded,
    isSignedIn: mockUserId !== null,
    user: mockUserId ? { id: mockUserId, username: null, imageUrl: null } : null,
  }),
}));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<React.ComponentType<Record<string, unknown>>>) =>
    function Lazy(props: Record<string, unknown>) {
      const [Loaded, setLoaded] = React.useState<React.ComponentType<
        Record<string, unknown>
      > | null>(null);
      React.useEffect(() => {
        void loader().then((component) => setLoaded(() => component));
      }, []);
      return Loaded ? <Loaded {...props} /> : null;
    },
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      wikios: { getWikitext: { invalidate: (...args: unknown[]) => mockInvalidate(...args) } },
      ixnayid: {
        getStatus: {
          invalidate: () => mockInvalidateStatus(),
          fetch: () =>
            mockStatusReadFails
              ? Promise.reject(new Error("offline"))
              : Promise.resolve({ handle: mockHandle }),
        },
      },
    }),
    ixnayid: {
      getStatus: {
        useQuery: () => ({ data: mockStatusLoaded ? { handle: mockHandle } : undefined }),
      },
      suggestHandle: { useQuery: () => ({ data: { handle: "alice_2" } }) },
      // The server takes the handle; the next status read reports it.
      setHandle: {
        useMutation: (opts: { onSuccess: (result: { handle: string }) => Promise<void> }) => ({
          isPending: false,
          mutate: (input: { handle: string }) => {
            mockSetHandle(input);
            mockHandle = input.handle;
            void opts.onSuccess({ handle: input.handle });
          },
        }),
      },
    },
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
      saveWikitext: {
        useMutation: () => ({ mutateAsync: (...args: unknown[]) => mockSave(...args) }),
      },
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
    const draft =
      props.restoreLocalDraft === false ? null : readDraft("user_alice", props.title, "ixwiki");
    React.useEffect(() => {
      props.registerContentReader?.(
        () => mockEditorContent ?? draft?.wikitext ?? props.initialWikitext
      );
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
  render(
    <WikiEditBridge
      title="Vesperia"
      initialMode="source"
      onClose={onClose}
      onSaveSuccess={onSaveSuccess}
    />
  );
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

/** A save left running while the handle picker is open: "saved", or what it threw. */
function startSave(content: string): Promise<unknown> {
  return lastSourceProps()
    .onSave(content, "summary", false)
    .then(
      () => "saved",
      (error: Error) => error
    );
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
    mockUserId = "user_alice";
    mockAuthLoaded = true;
    mockHandle = "alice";
    mockStatusLoaded = true;
    mockStatusReadFails = false;
    mockInvalidateStatus.mockResolvedValue(undefined);
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
  it("asks a player with no passport handle for one, and saves only after they pick it", async () => {
    mockHandle = null;
    await openEditor();

    const outcome = startSave("My text");

    const input = await screen.findByLabelText("Passport handle");
    expect(input).toHaveValue("alice_2");
    expect(mockSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(await outcome).toBe("saved");
    expect(mockSetHandle).toHaveBeenCalledWith({ handle: "alice" });
    expect(mockInvalidateStatus).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ wikitext: "My text" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("saves nothing when the player cancels the handle picker", async () => {
    mockHandle = null;
    await openEditor();

    const outcome = startSave("My text");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await outcome).toEqual(new Error("A passport handle is needed to save."));
    expect(mockSetHandle).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("reads the status on the save when it has not loaded yet", async () => {
    mockHandle = null;
    mockStatusLoaded = false;
    await openEditor();

    const outcome = startSave("My text");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await outcome).toEqual(new Error("A passport handle is needed to save."));
    expect(mockSave).not.toHaveBeenCalled();
  });
  it("lets the server decide when the status cannot be read", async () => {
    mockHandle = null;
    mockStatusLoaded = false;
    mockStatusReadFails = true;
    await openEditor();

    expect(await save("My text")).toBe("saved");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
  it("saves at once for a player who has a handle", async () => {
    await openEditor();
    await save("My text");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockSave).toHaveBeenCalledTimes(1);
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
  it("builds the next save of a session on the revision the last one created", async () => {
    await openEditor();
    await save("First", true);
    await save("Second", true);

    expect(mockSave.mock.calls[0]![0].baseRevisionRef).toBe("rev-1");
    expect(mockSave.mock.calls[1]![0].baseRevisionRef).toBe("rev-9");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("does not silently replace fresher server text with an older draft", async () => {
    saveDraft("user_alice", {
      title: "Vesperia",
      source: "ixwiki",
      mode: "source",
      wikitext: "Old draft",
      baseRevisionRef: "rev-0",
    });
    render(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);

    expect(await screen.findByText(/Older draft found/)).toBeTruthy();
    expect(mockSource).not.toHaveBeenCalled();
    expect(mockVisual).not.toHaveBeenCalled();
    expect(getDraft("user_alice", "Vesperia")?.wikitext).toBe("Old draft");

    fireEvent.click(screen.getByRole("button", { name: "Use current version" }));
    await screen.findByTestId("source");
    expect(lastSourceProps().initialWikitext).toBe("Server text");
    expect(getDraft("user_alice", "Vesperia")).toBeNull();
  });
  it("never offers another user's draft of the page (plan 416)", async () => {
    saveDraft("user_bob", {
      title: "Vesperia",
      source: "ixwiki",
      mode: "source",
      wikitext: "Bob's draft",
      baseRevisionRef: "rev-1",
    });

    await openEditor();

    expect(lastSourceProps().initialWikitext).toBe("Server text");
    expect(screen.queryByText(/Older draft found/)).toBeNull();
  });
  it("waits until the account is known before deciding about a draft", async () => {
    saveDraft("user_alice", {
      title: "Vesperia",
      source: "ixwiki",
      mode: "source",
      wikitext: "Alice's draft",
      baseRevisionRef: "rev-1",
    });
    mockAuthLoaded = false;
    const view = render(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);
    await act(async () => undefined);
    expect(mockSource).not.toHaveBeenCalled();

    mockAuthLoaded = true;
    view.rerender(<WikiEditBridge title="Vesperia" initialMode="source" onClose={onClose} />);

    await screen.findByTestId("source");
    expect(lastSourceProps().initialWikitext).toBe("Alice's draft");
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
  describe("'Load current version' against the real draft store", () => {
    async function conflictWithDraft(mode: "source" | "visual"): Promise<void> {
      mockSave.mockResolvedValueOnce(conflictResult("rev-2", "Their text"));
      render(<WikiEditBridge title="Vesperia" initialMode={mode} onClose={onClose} />);
      await screen.findByTestId(mode);
      // The author's own draft of the page exists while they edit (Save draft, or an earlier session).
      saveDraft("user_alice", {
        title: "Vesperia",
        source: "ixwiki",
        mode,
        wikitext: "My stale draft",
      });
      mockEditorContent = "My text";
      await act(async () => {
        try {
          await (mode === "source" ? lastSourceProps() : lastVisualProps()).onSave(
            "My text",
            "s",
            false
          );
        } catch {
          /* the conflict is the point */
        }
      });
      fireEvent.click(await screen.findByRole("button", { name: "Load current version" }));
    }

    it("keeps the author's text in the component: 'Restore my text' puts it back into the editor", async () => {
      await conflictWithDraft("visual");
      await screen.findByText(/Your version was set aside/);
      expect(getDraft("user_alice", "Vesperia")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Restore my text" }));

      await waitFor(() => expect(screen.getByTestId("visual").textContent).toBe("My text"));
      expect(screen.queryByText(/Your version was set aside/)).toBeNull();
      // one line of warning: saving replaces the current version with the restored text
      const warning = screen.getByText(/This is your text, not the current version/);
      expect(warning.closest("p")!.textContent).toContain(
        "saving will replace the current version"
      );
      // and it does not come back as a draft
      expect(getDraft("user_alice", "Vesperia")).toBeNull();
    });
  });
});
