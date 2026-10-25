/**
 * Native lore plan Task 4: what a host of `WikiEditBridge` (the lore writer) can see of the editor. It hears each
 * serialization of the visual editor (`onSerializedWikitext`, for its word count), can read the editor's content
 * as it is now in either mode (`registerContentReader`, to keep the author's text), and hears a refused save
 * (`onSaveError`, to say why), but not an edit conflict, which the bridge explains itself.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import type { WikitextSerializeResult } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { SaveRefusalShown } from "~/lib/wiki-os/editor/save-failure";

type Reader = (() => string | null) | null;

type EditorProps = {
  initialWikitext: string;
  onSave: (text: string, summary: string, minor: boolean) => Promise<void>;
  onSerializedWikitext?: (result: WikitextSerializeResult) => void;
  registerContentReader?: (read: Reader) => void;
  onSwitchToSource?: (dirty: boolean, content: string) => void;
  onSwitchToVisual?: (dirty: boolean, wikitext: string) => void;
};

const MISSING = { wikitext: "", revid: null, timestamp: null, revisionRef: null, revisionRefs: [] };

const mockVisual = jest.fn();
const mockSource = jest.fn();
const mockMutate = jest.fn();

jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: "user_alice", username: null, imageUrl: null },
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
    useUtils: () => ({ wikios: { getWikitext: { invalidate: jest.fn() } } }),
    wikios: {
      getWikitext: {
        useQuery: () => ({
          data: MISSING,
          isLoading: false,
          isError: false,
          isFetchedAfterMount: true,
          refetch: jest.fn(),
        }),
      },
      saveWikitext: { useMutation: () => ({ mutateAsync: mockMutate }) },
    },
  },
}));
jest.mock("~/hooks/useHandleGate", () => ({
  SaveCancelled: class SaveCancelled extends Error {},
  useHandleGate: () => ({ ensureHandle: () => Promise.resolve(true), dialog: {} }),
}));
jest.mock("~/components/wiki-os/editor/HandlePickerDialog", () => ({
  HandlePickerDialog: () => null,
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/wiki-os/editor/WikiVisualEditor", () => ({
  WikiVisualEditor: (props: EditorProps) => {
    mockVisual(props);
    return <div data-testid="visual" />;
  },
}));
jest.mock("~/components/wiki-os/editor/WikiSourceEditor", () => ({
  WikiSourceEditor: (props: EditorProps) => {
    mockSource(props);
    return <div data-testid="source" />;
  },
}));

const lastProps = (mock: jest.Mock): EditorProps => mock.mock.calls.at(-1)![0] as EditorProps;

interface HostHooks {
  onSerializedWikitext?: (result: WikitextSerializeResult) => void;
  registerContentReader?: (read: Reader) => void;
  onSaveError?: (error: Error) => void;
  onSaveStart?: () => void;
  onModeChange?: (mode: "source" | "visual") => void;
}

async function renderBridge(mode: "source" | "visual", hooks: HostHooks) {
  render(<WikiEditBridge title="Venceia" initialMode={mode} onClose={jest.fn()} {...hooks} />);
  await screen.findByTestId(mode);
}

describe("WikiEditBridge host hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("tells the host which editor is showing, as it opens and on each switch", async () => {
    const onModeChange = jest.fn();
    await renderBridge("visual", { onModeChange });
    expect(onModeChange).toHaveBeenLastCalledWith("visual");

    act(() => lastProps(mockVisual).onSwitchToSource?.(false, "Venceia is old."));
    await screen.findByTestId("source");
    expect(onModeChange).toHaveBeenLastCalledWith("source");

    act(() => lastProps(mockSource).onSwitchToVisual?.(false, "Venceia is old."));
    await screen.findByTestId("visual");
    expect(onModeChange).toHaveBeenLastCalledWith("visual");
  });

  it("passes each serialization of the visual editor to the host", async () => {
    const onSerializedWikitext = jest.fn();
    await renderBridge("visual", { onSerializedWikitext });

    const result = { wikitext: "Venceia is old.", complete: true, notices: [] };
    act(() => lastProps(mockVisual).onSerializedWikitext?.(result));

    expect(onSerializedWikitext).toHaveBeenCalledWith(result);
  });

  it.each(["visual", "source"] as const)(
    "hands the host the %s editor's content reader, and null when it goes away",
    async (mode) => {
      const registerContentReader = jest.fn();
      await renderBridge(mode, { registerContentReader });

      const read = () => "my text";
      act(() =>
        lastProps(mode === "visual" ? mockVisual : mockSource).registerContentReader?.(read)
      );
      expect(registerContentReader).toHaveBeenLastCalledWith(read);

      act(() =>
        lastProps(mode === "visual" ? mockVisual : mockSource).registerContentReader?.(null)
      );
      expect(registerContentReader).toHaveBeenLastCalledWith(null);
    }
  );

  it("tells the host why a save was refused, and fails the save as already shown (no second notice)", async () => {
    const onSaveError = jest.fn();
    const refusal = Object.assign(new Error("This page was deleted; ask an administrator"), {
      data: { code: "PRECONDITION_FAILED" },
    });
    mockMutate.mockRejectedValue(refusal);
    await renderBridge("source", { onSaveError });

    let failure: Error | null = null;
    await act(async () => {
      failure = await lastProps(mockSource)
        .onSave("text", "", false)
        .then(
          () => null,
          (error: Error) => error
        );
    });

    expect(onSaveError).toHaveBeenCalledWith(refusal);
    expect(failure).toBeInstanceOf(SaveRefusalShown);
    expect((failure as Error | null)?.cause).toBe(refusal);
  });

  it("fails a refused save with the server's error when no host shows it", async () => {
    const refusal = Object.assign(new Error("Slow down"), { data: { code: "TOO_MANY_REQUESTS" } });
    mockMutate.mockRejectedValue(refusal);
    await renderBridge("source", {});

    await act(async () => {
      await expect(lastProps(mockSource).onSave("text", "", false)).rejects.toBe(refusal);
    });
  });

  it("tells the host when a save starts", async () => {
    const onSaveStart = jest.fn();
    mockMutate.mockImplementation(() => {
      expect(onSaveStart).toHaveBeenCalledTimes(1);
      return Promise.resolve({
        success: true,
        revisionId: "r1",
        nullEdit: false,
        title: "Venceia",
      });
    });
    await renderBridge("source", { onSaveStart });

    await act(async () => {
      await lastProps(mockSource).onSave("text", "", false);
    });
    expect(mockMutate).toHaveBeenCalled();
  });

  it("does not call an edit conflict a refused save (the bridge shows the conflict)", async () => {
    const onSaveError = jest.fn();
    mockMutate.mockResolvedValue({
      success: false,
      currentWikitext: "theirs",
      currentRevisionRef: "rev-2",
    });
    await renderBridge("source", { onSaveError });

    await act(async () => {
      await expect(lastProps(mockSource).onSave("text", "", false)).rejects.toThrow(/conflict/i);
    });

    expect(onSaveError).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/someone else saved this page/i);
  });
});
