/**
 * Native lore plan Task 3: `WikiEditBridge.prefillWikitext` is the opening text of a page that does not exist (the
 * load answered with no revision and no text). An existing page always opens on its own text, a failed or racing
 * load never falls back to the prefill, and the author's own draft wins over it.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { saveDraft } from "~/lib/wiki-os/editor/draft-store";

type EditorProps = {
  title: string;
  initialWikitext: string;
  onSwitchToVisual?: (dirty: boolean, wikitext: string) => void;
  onSwitchToSource?: (dirty: boolean, wikitext: string) => void;
};

interface MockLoad {
  data:
    | {
        wikitext: string;
        revid: number | null;
        timestamp: string | null;
        revisionRef: string | null;
        revisionRefs: string[];
      }
    | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetchedAfterMount: boolean;
}

const PREFILL = "{{Infobox settlement\n| name = Venceia\n}}\n\n== History ==\n";
const MISSING = { wikitext: "", revid: null, timestamp: null, revisionRef: null, revisionRefs: [] };
const EXISTING = {
  wikitext: "Venceia is the capital.",
  revid: null,
  timestamp: "2026-10-01T00:00:00.000Z",
  revisionRef: "rev-9",
  revisionRefs: ["rev-9", "9"],
};

let mockLoad: MockLoad;
const mockSource = jest.fn();
const mockVisual = jest.fn();

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
      getWikitext: { useQuery: () => ({ ...mockLoad, refetch: jest.fn() }) },
      saveWikitext: { useMutation: () => ({ mutateAsync: jest.fn() }) },
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
    return <div data-testid="visual">{props.initialWikitext}</div>;
  },
}));
jest.mock("~/components/wiki-os/editor/WikiSourceEditor", () => ({
  WikiSourceEditor: (props: EditorProps) => {
    mockSource(props);
    return <div data-testid="source">{props.initialWikitext}</div>;
  },
}));

const loadedWith = (data: MockLoad["data"], extra: Partial<MockLoad> = {}): MockLoad => ({
  data,
  isLoading: false,
  isError: false,
  isFetchedAfterMount: true,
  ...extra,
});

function Bridge({ mode = "source" }: { mode?: "source" | "visual" }) {
  return (
    <WikiEditBridge
      title="Venceia"
      initialMode={mode}
      prefillWikitext={PREFILL}
      onClose={jest.fn()}
    />
  );
}

const lastSourceProps = (): EditorProps => mockSource.mock.calls.at(-1)![0] as EditorProps;

describe("WikiEditBridge prefillWikitext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockLoad = loadedWith(MISSING);
  });

  it("opens a page that does not exist on the prefill, in the source editor", async () => {
    render(<Bridge />);

    expect((await screen.findByTestId("source")).textContent).toBe(PREFILL);
  });

  it("opens a page that does not exist on the prefill, in the visual editor", async () => {
    render(<Bridge mode="visual" />);

    expect((await screen.findByTestId("visual")).textContent).toBe(PREFILL);
  });

  it("opens an existing page on the page's text, never the prefill", async () => {
    mockLoad = loadedWith(EXISTING);
    render(<Bridge />);

    expect((await screen.findByTestId("source")).textContent).toBe(EXISTING.wikitext);
  });

  it("opens an existing page whose head revision could not be read on its text", async () => {
    mockLoad = loadedWith({ ...EXISTING, revisionRef: null, revisionRefs: [] });
    render(<Bridge />);

    expect((await screen.findByTestId("source")).textContent).toBe(EXISTING.wikitext);
  });

  it("does not fall back to the prefill when the load failed", async () => {
    mockLoad = loadedWith(undefined, { isError: true });
    render(<Bridge />);

    expect((await screen.findByTestId("source")).textContent).toBe("");
  });

  it("does not use a cached 'missing' answer when the fresh load failed", async () => {
    mockLoad = loadedWith(MISSING, { isError: true });
    render(<Bridge />);

    expect((await screen.findByTestId("source")).textContent).toBe("");
  });

  it("waits for the fresh load: a cached 'missing' answer from before the page existed is not used", async () => {
    mockLoad = loadedWith(MISSING, { isFetchedAfterMount: false });
    const { rerender } = render(<Bridge />);
    expect(screen.queryByTestId("source")).toBeNull();

    mockLoad = loadedWith(EXISTING);
    rerender(<Bridge />);

    expect((await screen.findByTestId("source")).textContent).toBe(EXISTING.wikitext);
  });

  it("keeps the text it opened on when a later answer says the page now exists", async () => {
    const { rerender } = render(<Bridge />);
    await screen.findByTestId("source");

    mockLoad = loadedWith(EXISTING);
    rerender(<Bridge />);

    expect(screen.getByTestId("source").textContent).toBe(PREFILL);
  });

  it("restores the author's own draft over the prefill", async () => {
    saveDraft("user_alice", {
      title: "Venceia",
      source: "ixwiki",
      mode: "source",
      wikitext: "My draft",
      baseRevisionRef: null,
    });
    render(<Bridge />);

    expect((await screen.findByTestId("source")).textContent).toBe("My draft");
  });

  it("keeps the prefill across a switch to the visual editor with no changes", async () => {
    render(<Bridge />);
    await screen.findByTestId("source");

    act(() => lastSourceProps().onSwitchToVisual?.(false, PREFILL));

    expect((await screen.findByTestId("visual")).textContent).toBe(PREFILL);
  });

  it("opens a missing page on empty text without a prefill, as before", async () => {
    render(<WikiEditBridge title="Venceia" onClose={jest.fn()} />);

    expect((await screen.findByTestId("source")).textContent).toBe("");
  });
});
