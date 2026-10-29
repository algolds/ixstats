/**
 * An editor that opens on text the page does not have (edits carried over a source/canvas switch) starts dirty. It
 * used to start clean: the other editor's Cancel closed without asking and the author's edits were gone, and the
 * "Unsaved" mark and the leave-page warning were off.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";

type Reader = (() => string | null) | null;

type EditorProps = {
  startDirty?: boolean;
  initialWikitext: string;
  onSave: (text: string, summary: string, minor: boolean) => Promise<void>;

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

describe("WikiEditBridge: an editor that opens on carried edits starts dirty", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("the first editor, on the page's own text, starts clean", async () => {
    render(<WikiEditBridge title="Venceia" initialMode="source" onClose={jest.fn()} />);
    await screen.findByTestId("source");
    expect(lastProps(mockSource).startDirty).toBe(false);
  });

  it("switching with edits opens the other editor dirty", async () => {
    render(<WikiEditBridge title="Venceia" initialMode="source" onClose={jest.fn()} />);
    await screen.findByTestId("source");
    act(() => lastProps(mockSource).onSwitchToVisual?.(true, "Venceia, written."));
    await screen.findByTestId("visual");
    expect(lastProps(mockVisual).startDirty).toBe(true);
  });

  it("switching without edits opens the other editor clean", async () => {
    render(<WikiEditBridge title="Venceia" initialMode="source" onClose={jest.fn()} />);
    await screen.findByTestId("source");
    act(() => lastProps(mockSource).onSwitchToVisual?.(false, ""));
    await screen.findByTestId("visual");
    expect(lastProps(mockVisual).startDirty).toBe(false);
  });
});
