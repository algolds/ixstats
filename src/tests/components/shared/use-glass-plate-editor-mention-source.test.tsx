import { renderHook } from "@testing-library/react";
import { createEditor } from "slate";

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
