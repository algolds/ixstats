import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { createEditor } from "slate";

interface MenuProps {
  results: Array<{ id: string; name: string }>;
  isLoading: boolean;
}
const mockAccountsQuery = jest.fn((_input?: object, _options?: { enabled?: boolean }) => ({
  data: [
    { id: "a1", username: "owen", displayName: "Owen Vale" },
    { id: "a2", username: "zed", displayName: "Zed" },
  ],
  isLoading: false,
}));
// A disabled query has no data, as react-query's.
const mockWikiQuery = jest.fn((_input?: object, options?: { enabled?: boolean }) => ({
  data: options?.enabled ? [{ title: "Owl", source: "ixwiki" }] : undefined,
  isLoading: false,
}));
const mockSportsQuery = jest.fn((_input?: object, options?: { enabled?: boolean }) => ({
  data: options?.enabled ? { leagues: [{ id: "l1", name: "Owl League" }], teams: [] } : undefined,
  isLoading: false,
}));
const mockEditor = createEditor();
interface Leaf {
  text: string;
}
interface WikiLink {
  type: "wikilink";
  target: string;
  children: Leaf[];
}
type Block = Leaf | WikiLink;
/** One paragraph per entry; the cursor sits at the end of the last paragraph's last leaf. */
function typeBlocks(...paragraphs: Block[][]) {
  mockEditor.children = paragraphs.map((children) => ({ type: "p", children })) as never;
  const block = paragraphs.length - 1;
  const leaf = paragraphs[block]!.length - 1;
  const last = paragraphs[block]![leaf]!;
  const text = "text" in last ? last.text : last.children[0]!.text;
  const at = { path: [block, leaf], offset: text.length };
  mockEditor.selection = { anchor: at, focus: at };
}
const typeText = (text: string) => typeBlocks([{ text }]);
Object.assign(mockEditor, {
  tf: { setValue: jest.fn() },
  isInline: () => false,
  isVoid: () => false,
});

jest.mock("next/dynamic", () => () => () => null);
jest.mock("platejs/react", () => ({
  createPlateEditor: () => mockEditor,
  ParagraphPlugin: {},
  Plate: ({
    children,
    onChange,
  }: {
    children: React.ReactNode;
    onChange: (change: { value: object[] }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange({ value: mockEditor.children })}>
        type
      </button>
      {children}
    </div>
  ),
  PlateContent: () => <div />,
}));
jest.mock("slate-react", () => ({ ReactEditor: { focus: jest.fn() } }));
jest.mock("~/components/shared/editor/EditorPlugins", () => ({}));
jest.mock("~/components/shared/editor/EditorToolbar", () => ({ EditorToolbar: () => null }));
jest.mock("~/components/shared/editor/WikiAndStashPopovers", () => ({
  WikiAndStashPopovers: () => null,
}));
jest.mock("~/components/shared/editor/SlateSerializer", () => ({
  slateNodesToHtml: () => "",
  slateNodesToBbcode: () => "",
  parsoidHtmlToSlate: () => [{ type: "p", children: [{ text: "" }] }],
  isMarkActive: () => false,
  toggleMark: jest.fn(),
  toggleBlock: jest.fn(),
}));
jest.mock("~/components/shared/editor/MentionMenuPortal", () => ({
  MentionMenuPortal: ({ results, isLoading }: MenuProps) => (
    <ul data-testid="menu" data-loading={String(isLoading)}>
      {results.map((r) => (
        <li key={r.id}>{r.name}</li>
      ))}
    </ul>
  ),
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

import { GlassPlateEditor } from "~/components/shared/editor/GlassPlateEditor";

const menuItems = () => screen.getAllByRole("listitem").map((li) => li.textContent);

function typeAt() {
  fireEvent.click(screen.getByRole("button", { name: "type" }));
}

beforeEach(() => {
  mockAccountsQuery.mockClear();
  mockWikiQuery.mockClear();
  mockSportsQuery.mockClear();
  window.getSelection = () =>
    ({
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ bottom: 10, left: 5 }) }),
    }) as never;
});

describe("GlassPlateEditor @ menu", () => {
  it("lists the member's own personas, as before, when no mention source is given", () => {
    typeText("@");
    render(<GlassPlateEditor />);
    expect(mockAccountsQuery).toHaveBeenCalledWith(undefined, { staleTime: 60_000, enabled: true });
    typeAt();
    expect(menuItems()).toEqual(["@owen", "@zed"]);
  });

  it("still closes on a typed name when no mention source is given", () => {
    typeText("@ow");
    render(<GlassPlateEditor />);
    typeAt();
    expect(screen.queryByTestId("menu")).toBeNull();
  });

  describe("with a mention source", () => {
    const items = [{ kind: "user" as const, name: "owena", label: "owena", avatarUrl: null }];
    const withSource = (onQueryChange = jest.fn()) =>
      render(<GlassPlateEditor mentionSource={{ items, isLoading: true, onQueryChange }} />);

    it("lists the source's names only, asks for no personas, wiki or sports, and reports the typed name", () => {
      typeText("hi @ow");
      const onQueryChange = jest.fn();
      withSource(onQueryChange);
      expect(mockAccountsQuery).toHaveBeenCalledWith(undefined, {
        staleTime: 60_000,
        enabled: false,
      });
      typeAt();
      expect(menuItems()).toEqual(["@owena"]);
      expect(screen.getByTestId("menu")).toHaveAttribute("data-loading", "true");
      expect(onQueryChange).toHaveBeenLastCalledWith("ow");
      for (const call of [...mockWikiQuery.mock.calls, ...mockSportsQuery.mock.calls]) {
        expect(call[1]).toEqual(expect.objectContaining({ enabled: false }));
      }
    });

    it.each([
      ["at a block start", [[{ text: "@ki" }]], "ki"],
      ["in a second block", [[{ text: "first" }], [{ text: "@ki" }]], "ki"],
      ["after punctuation", [[{ text: "(@ki" }]], "ki"],
      ["with an underscore in the name", [[{ text: "hey @kir_n" }]], "kir_n"],
      ["after an emoji", [[{ text: "\u{1F600}@ki" }]], "ki"],
      [
        "right after an inline wikilink",
        [
          [
            { text: "" },
            { type: "wikilink", target: "Page", children: [{ text: "Page" }] },
            { text: "@ki" },
          ],
        ],
        "ki",
      ],
      ["as a bare @", [[{ text: "x @" }]], ""],
    ] as Array<[string, Block[][], string]>)(
      "opens on a typed name %s",
      (_label, paragraphs, query) => {
        typeBlocks(...paragraphs);
        const onQueryChange = jest.fn();
        withSource(onQueryChange);
        typeAt();
        expect(screen.getByTestId("menu")).toBeInTheDocument();
        expect(onQueryChange).toHaveBeenLastCalledWith(query);
      }
    );

    it.each([["mail me@ow"], ["@@ow"], ["word_@ow"], ["no at sign"], ["x@"]])(
      "stays closed for %s",
      (text) => {
        typeText(text);
        withSource();
        typeAt();
        expect(screen.queryByTestId("menu")).toBeNull();
      }
    );
  });
});
