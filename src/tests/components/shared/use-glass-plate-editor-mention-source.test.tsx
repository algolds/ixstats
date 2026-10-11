import { act, renderHook } from "@testing-library/react";
import { createEditor, Node as SlateNode, type Editor } from "slate";

const mockCreateEditor = jest.fn();
const mockAccountsQuery = jest.fn((_input?: object, _options?: { enabled?: boolean }) => ({
  data: [{ id: "a1", username: "own", displayName: "Own" }],
  isLoading: false,
}));
// Cached results from another editor's query stay in react-query's cache and come back even when disabled.
const mockWikiQuery = jest.fn(() => ({
  data: [{ title: "Owl", source: "ixwiki" }],
  isLoading: false,
}));
const mockSportsQuery = jest.fn(() => ({
  data: { leagues: [{ id: "l1", name: "Owl League" }], teams: [] },
  isLoading: false,
}));
jest.mock("platejs/react", () => ({
  createPlateEditor: (...args: object[]) => mockCreateEditor(...args),
  ParagraphPlugin: {},
}));
jest.mock("slate-react", () => ({ ReactEditor: { focus: jest.fn() } }));
jest.mock("~/components/shared/editor/EditorPlugins", () => ({}));
jest.mock("~/components/shared/editor/SlateSerializer", () => ({
  slateNodesToHtml: () => "",
  parsoidHtmlToSlate: () => [{ type: "p", children: [{ text: "" }] }],
  toggleMark: jest.fn(),
}));
jest.mock("~/trpc/react", () => {
  const query = () => ({ data: undefined, isLoading: false });
  const group = new Proxy({}, { get: () => ({ useQuery: query }) });
  return {
    api: new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === "thinkpages"
            ? { getMyAccounts: { useQuery: mockAccountsQuery } }
            : prop === "wikios"
              ? new Proxy(
                  {},
                  {
                    get: (_t, name) =>
                      name === "search" ? { useQuery: mockWikiQuery } : { useQuery: query },
                  }
                )
              : prop === "sports"
                ? { searchSportsEntities: { useQuery: mockSportsQuery } }
                : group,
      }
    ),
  };
});

import { useGlassPlateEditor } from "~/components/shared/editor/useGlassPlateEditor";

function setup(mentionSource?: Parameters<typeof useGlassPlateEditor>[0]["mentionSource"]) {
  const editor = createEditor();
  editor.children = [{ type: "p", children: [{ text: "" }] }] as never;
  Object.assign(editor, {
    tf: { setValue: jest.fn() },
    isInline: () => false,
    isVoid: () => false,
  });
  mockCreateEditor.mockReturnValue(editor);
  return renderHook(() => useGlassPlateEditor({ mentionSource }));
}

beforeEach(() => mockAccountsQuery.mockClear());

describe("useGlassPlateEditor mentionSource", () => {
  it("keeps asking for the member's own personas when no source is given", () => {
    setup();
    expect(mockAccountsQuery).toHaveBeenCalledWith(undefined, { staleTime: 60_000, enabled: true });
  });

  it("does not ask for them when a source replaces them, and tells the source the query, empty at first", () => {
    const onQueryChange = jest.fn();
    setup({ items: [], isLoading: false, onQueryChange });
    expect(mockAccountsQuery).toHaveBeenCalledWith(undefined, {
      staleTime: 60_000,
      enabled: false,
    });
    expect(onQueryChange).toHaveBeenCalledWith("");
  });

  it("reports the source's loading state as the menu's", () => {
    const { result } = setup({ items: [], isLoading: true, onQueryChange: jest.fn() });
    expect(result.current.mentionLoading).toBe(true);
  });

  it("keeps cached wiki and sports results out of a source's menu, but not out of the default one", () => {
    const { result } = setup({
      items: [{ kind: "user", name: "owena", label: "owena", avatarUrl: null }],
      isLoading: false,
      onQueryChange: jest.fn(),
    });
    expect(result.current.mentionResults.map((r) => r.type)).toEqual(["user"]);
    const { result: own } = setup();
    expect(own.current.mentionResults.map((r) => r.type)).toEqual(["user", "league", "wiki"]);
  });
});

type Source = NonNullable<Parameters<typeof useGlassPlateEditor>[0]["mentionSource"]>;
const names = ["kia", "kim", "kira", "kit", "kito", "kiwi"];
const sourceOf = (picked: readonly string[]): Source => ({
  items: picked.map((name) => ({ kind: "user" as const, name, label: name, avatarUrl: null })),
  isLoading: false,
  onQueryChange: jest.fn(),
});

function menuSetup(initial: Source) {
  const editor = createEditor();
  editor.children = [{ type: "p", children: [{ text: "" }] }] as never;
  Object.assign(editor, {
    tf: { setValue: jest.fn() },
    isInline: () => false,
    isVoid: () => false,
  });
  mockCreateEditor.mockReturnValue(editor);
  const view = renderHook(
    ({ mentionSource }: { mentionSource: Source }) => useGlassPlateEditor({ mentionSource }),
    { initialProps: { mentionSource: initial } }
  );
  return { editor, view };
}

function typeAt(editor: Editor, view: ReturnType<typeof menuSetup>["view"], text: string) {
  editor.children = [{ type: "p", children: [{ text }] }] as never;
  editor.selection = {
    anchor: { path: [0, 0], offset: text.length },
    focus: { path: [0, 0], offset: text.length },
  };
  act(() => view.result.current.handleEditorChange({ value: editor.children }));
}

const press = (view: ReturnType<typeof menuSetup>["view"], key: string) =>
  act(() => view.result.current.handleKeyDown({ key, preventDefault: jest.fn() } as never));

describe("useGlassPlateEditor @ menu selection", () => {
  const getSelection = jest.spyOn(window, "getSelection");
  beforeEach(() => {
    getSelection.mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ bottom: 10, left: 5 }) }),
    } as never);
  });
  afterAll(() => getSelection.mockRestore());

  it("highlights the first row again when the typed name narrows the list, so Enter picks it", () => {
    const { editor, view } = menuSetup(sourceOf(names));
    typeAt(editor, view, "@ki");
    for (let i = 0; i < 4; i += 1) press(view, "ArrowDown");
    expect(view.result.current.mentionSelectedIndex).toBe(4);
    view.rerender({ mentionSource: sourceOf(["kir", "kira"]) });
    typeAt(editor, view, "@kir");
    expect(view.result.current.mentionSelectedIndex).toBe(0);
    press(view, "Enter");
    expect(SlateNode.string(editor)).toBe("@kir ");
  });

  it("picks the last row when the list shrinks under a stale index before the query changes", () => {
    const { editor, view } = menuSetup(sourceOf(names));
    typeAt(editor, view, "@ki");
    for (let i = 0; i < 4; i += 1) press(view, "ArrowDown");
    view.rerender({ mentionSource: sourceOf(["kir", "kira"]) });
    press(view, "Tab");
    expect(SlateNode.string(editor)).toBe("@kira ");
  });

  it("opens the next menu on its first row after a pick", () => {
    const { editor, view } = menuSetup(sourceOf(names));
    typeAt(editor, view, "@ki");
    for (let i = 0; i < 3; i += 1) press(view, "ArrowDown");
    press(view, "Enter");
    expect(view.result.current.mentionSelectedIndex).toBe(0);
    typeAt(editor, view, "@ki");
    expect(view.result.current.mentionSelectedIndex).toBe(0);
  });
});
