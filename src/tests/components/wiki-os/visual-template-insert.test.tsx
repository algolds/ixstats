/**
 * F31 (UI): inserting a template in the visual editor when the server's preview cannot be had (rate limit,
 * refused parameters, signed out) still inserts it, as its wikitext, and tells the author.
 */
import { act, renderHook } from "@testing-library/react";
import { createEditor, type Descendant } from "slate";

const mockFetch = jest.fn();
const mockWarning = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getTemplatePreview: { fetch: (...args: unknown[]) => mockFetch(...args) } } }),
    wikios: { previewWikitext: { useMutation: () => ({ mutateAsync: jest.fn() }) } },
  },
}));
// Plate ships as ESM that Jest does not transform; the hook only takes `nanoid` from it
jest.mock("platejs", () => ({ nanoid: () => "node-id" }));
jest.mock("~/hooks/useNotify", () => {
  const notify = { warning: (...args: unknown[]) => mockWarning(...args) };
  return { useNotify: () => notify };
});

import { useWikiVisualFormatting } from "~/components/wiki-os/editor/hooks/useWikiVisualFormatting";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";

function setup() {
  const editor = createEditor();
  editor.children = [{ type: "p", children: [{ text: "" }] }] as Descendant[];
  editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
  const setIsDirty = jest.fn();
  const view = renderHook(() =>
    useWikiVisualFormatting({
      title: "Vesperia",
      editorRef: { current: editor as never },
      setIsDirty,
    })
  );
  return { editor, setIsDirty, view };
}

const inserted = (editor: ReturnType<typeof createEditor>) =>
  editor.children.find((node) => (node as { type?: string }).type === "raw-html") as
    | { name: string; html: string; wikitext: string; params: Record<string, string> }
    | undefined;

describe("handleInsertTemplate when the preview fails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("inserts the template with its preview when the server answers", async () => {
    mockFetch.mockResolvedValue("<table><tr><td>Vesperia</td></tr></table>");
    const { editor, setIsDirty, view } = setup();

    await act(() => view.result.current.handleInsertTemplate("Infobox country", { name: "Vesperia" }));

    expect(inserted(editor)?.html).toContain("<table><tr><td>Vesperia</td></tr></table>");
    expect(inserted(editor)?.wikitext).toBe("{{Infobox country|name=Vesperia}}");
    expect(setIsDirty).toHaveBeenCalledWith(true);
    expect(mockWarning).not.toHaveBeenCalled();
  });

  it("inserts it with no preview, saves as its wikitext, and warns when the call is refused", async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error("Too many requests"), { data: { code: "TOO_MANY_REQUESTS" } }));
    const { editor, setIsDirty, view } = setup();

    await act(() => view.result.current.handleInsertTemplate("Infobox country", { name: "Vesperia" }));

    const node = inserted(editor);
    expect(node).toMatchObject({ name: "Infobox country", html: "", wikitext: "{{Infobox country|name=Vesperia}}" });
    expect(setIsDirty).toHaveBeenCalledWith(true);
    expect(mockWarning).toHaveBeenCalledWith(
      "Template inserted without a preview",
      "{{Infobox country}} is in the page as written. Too many previews were asked for just now; try again in a minute."
    );
    // what a save writes is the template, complete: the missing preview costs the page nothing
    const saved = serializePlateToWikitext(editor.children as Descendant[]);
    expect(saved.complete).toBe(true);
    expect(saved.wikitext).toContain("{{Infobox country|name=Vesperia}}");
  });

  it("says to sign in when signed out, and gives the generic reason for any other failure", async () => {
    const { editor, view } = setup();

    mockFetch.mockRejectedValueOnce(Object.assign(new Error("UNAUTHORIZED"), { data: { code: "UNAUTHORIZED" } }));
    await act(() => view.result.current.handleInsertTemplate("Flag", { 1: "Vesperia" }));
    expect(mockWarning.mock.calls[0]?.[1]).toContain("Sign in to preview templates.");

    mockFetch.mockRejectedValueOnce(new Error("network down"));
    await act(() => view.result.current.handleInsertTemplate("Flag", { 1: "Vesperia" }));
    expect(mockWarning.mock.calls[1]?.[1]).toContain("The preview service did not answer.");
    expect(editor.children.filter((node) => (node as { type?: string }).type === "raw-html")).toHaveLength(2);
  });
});
