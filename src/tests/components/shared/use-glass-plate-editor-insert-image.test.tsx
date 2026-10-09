import { act, renderHook } from "@testing-library/react";
import { createEditor } from "slate";

const mockCreateEditor = jest.fn();
jest.mock("platejs/react", () => ({
  createPlateEditor: (...args: unknown[]) => mockCreateEditor(...args),
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
  return { api: new Proxy({}, { get: () => group }) };
});

import { useGlassPlateEditor } from "~/components/shared/editor/useGlassPlateEditor";

describe("useGlassPlateEditor insertImageUrl", () => {
  it("inserts an img node with the url and an empty alt into the document", () => {
    const editor = createEditor();
    editor.children = [{ type: "p", children: [{ text: "" }] }] as never;
    Object.assign(editor, {
      tf: { setValue: jest.fn() },
      isInline: () => false,
      isVoid: () => false,
    });
    mockCreateEditor.mockReturnValue(editor);

    const { result } = renderHook(() => useGlassPlateEditor({}));
    act(() => result.current.insertImageUrl("https://x/y.png"));

    expect(JSON.stringify(editor.children)).toContain(
      '"type":"img","src":"https://x/y.png","alt":""'
    );
  });
});
