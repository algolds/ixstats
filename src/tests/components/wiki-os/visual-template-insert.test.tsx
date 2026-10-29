/**
 * Canvas templates are text first, preview second. Inserting one used to wait for the server's preview (seconds, or a
 * timeout) before anything entered the document, so a mode switch or a save in the meantime dropped it; editing one's
 * parameters applied them only once the preview came back, and never when it failed (the edit was silently lost).
 */
import { act, renderHook } from "@testing-library/react";
import { createEditor, type Descendant } from "slate";
import { useWikiVisualFormatting } from "~/components/wiki-os/editor/hooks/useWikiVisualFormatting";

let resolvePreview: (html: string) => void = () => undefined;
let rejectPreview: (error: Error) => void = () => undefined;
const pending = () =>
  new Promise<string>((resolve, reject) => {
    resolvePreview = resolve;
    rejectPreview = reject;
  });
const mockFetchPreview = jest.fn(pending);
const mockPreviewMutate = jest.fn(() => pending().then((html) => ({ html })));

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: { previewWikitext: { useMutation: () => ({ mutateAsync: mockPreviewMutate }) } },
    useUtils: () => ({ wikios: { getTemplatePreview: { fetch: mockFetchPreview } } }),
  },
}));
jest.mock("platejs", () => ({ nanoid: () => `id-${Math.random().toString(36).slice(2)}` }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));

type Node = {
  type?: string;
  id?: string;
  wikitext?: string;
  html?: string;
  params?: Record<string, string>;
};

function setup(children: Descendant[]) {
  const editor = createEditor();
  editor.children = children;
  const setIsDirty = jest.fn();
  const hook = renderHook(() =>
    useWikiVisualFormatting({
      title: "Page",
      editorRef: { current: editor as never },
      setIsDirty,
    })
  );
  return { editor, hook, setIsDirty };
}

const templates = (editor: ReturnType<typeof createEditor>) =>
  (editor.children as Node[]).filter((n) => n.type === "raw-html");

describe("canvas templates: the text goes in at once, the preview follows", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));

  it("an inserted template is in the document before its preview arrives, and gets the preview after", async () => {
    const { editor, hook } = setup([{ type: "p", children: [{ text: "x" }] } as Descendant]);
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = hook.result.current.handleInsertTemplate("Infobox Country", { name: "A" });
    });
    expect(templates(editor)).toHaveLength(1);
    expect(templates(editor)[0]!.wikitext).toContain("Infobox Country");
    await act(async () => {
      resolvePreview("<p>preview</p>");
      await done;
    });
    expect(templates(editor)[0]!.html).toContain("preview");
  });

  it("an inserted template stays when its preview fails", async () => {
    const { editor, hook } = setup([{ type: "p", children: [{ text: "x" }] } as Descendant]);
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = hook.result.current.handleInsertTemplate("Infobox Country", { name: "A" });
    });
    await act(async () => {
      rejectPreview(new Error("timeout"));
      await done;
    });
    expect(templates(editor)).toHaveLength(1);
  });

  it("edited parameters apply at once, even when the preview fails", async () => {
    const node = {
      type: "raw-html",
      id: "t1",
      name: "Infobox Country",
      params: { name: "Old" },
      wikitext: "{{Infobox Country\n| name = Old\n}}",
      html: "",
      children: [{ text: "" }],
    };
    const { editor, hook, setIsDirty } = setup([node as Descendant]);
    act(() =>
      hook.result.current.setEditingTemplate({
        id: "t1",
        name: "Infobox Country",
        params: { name: "Old" },
      })
    );
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = hook.result.current.handleTemplateUpdate({ name: "New" });
    });
    expect(templates(editor)[0]!.params).toEqual({ name: "New" });
    expect(templates(editor)[0]!.wikitext).toContain("New");
    expect(setIsDirty).toHaveBeenCalledWith(true);
    await act(async () => {
      rejectPreview(new Error("timeout"));
      await done;
    });
    expect(templates(editor)[0]!.wikitext).toContain("New");
  });
});
