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
const mockEditor = createEditor();
function typeText(text: string) {
  mockEditor.children = [{ type: "p", children: [{ text }] }] as never;
  const at = { path: [0, 0], offset: text.length };
  mockEditor.selection = { anchor: at, focus: at };
}
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
          prop === "thinkpages" ? { getMyAccounts: { useQuery: mockAccountsQuery } } : group,
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

  it("lists the source's names instead, asks for no personas and reports the typed name", () => {
    typeText("hi @ow");
    const onQueryChange = jest.fn();
    render(
      <GlassPlateEditor
        mentionSource={{
          items: [{ kind: "user", name: "owena", label: "owena", avatarUrl: null }],
          isLoading: true,
          onQueryChange,
        }}
      />
    );
    expect(mockAccountsQuery).toHaveBeenCalledWith(undefined, {
      staleTime: 60_000,
      enabled: false,
    });
    typeAt();
    expect(menuItems()).toEqual(["@owena"]);
    expect(screen.getByTestId("menu")).toHaveAttribute("data-loading", "true");
    expect(onQueryChange).toHaveBeenLastCalledWith("ow");
  });

  it("does not take an address for a mention", () => {
    typeText("mail me@ow");
    render(
      <GlassPlateEditor mentionSource={{ items: [], isLoading: false, onQueryChange: jest.fn() }} />
    );
    typeAt();
    expect(screen.queryByTestId("menu")).toBeNull();
  });
});
