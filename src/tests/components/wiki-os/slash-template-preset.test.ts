import { createEditor, Editor, Transforms, type Descendant } from "slate";
import { SLASH_ITEMS } from "~/components/wiki-os/editor/plate/slash-menu/slash-items";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";

// platejs ships ESM-only; the preset adapter only needs its nanoid.
jest.mock("platejs", () => {
  let counter = 0;
  return { nanoid: () => `preset-${++counter}` };
});

function newEditor() {
  const editor = createEditor();
  editor.children = [{ type: "p", children: [{ text: "" }] } as unknown as Descendant];
  Transforms.select(editor, Editor.end(editor, []));
  return editor;
}

function rawHtmlIds(nodes: Descendant[]): string[] {
  return nodes
    .map((n) => n as unknown as { type?: string; id?: string })
    .filter((n) => n.type === "raw-html")
    .map((n) => n.id ?? "");
}

describe("slash-menu template presets", () => {
  const item = SLASH_ITEMS.find((i) => i.id === "template:Infobox country");

  it("serializes an inserted preset as template wikitext, not placeholder HTML", () => {
    const editor = newEditor();
    item!.execute(editor);
    const { wikitext, complete } = serializePlateToWikitext(editor.children);
    expect(complete).toBe(true);
    expect(wikitext).toContain("{{Infobox country");
    expect(wikitext).toContain("| capital = ");
    expect(wikitext).not.toContain("<div");
  });

  it("builds a fresh node id on every insert", () => {
    const editor = newEditor();
    item!.execute(editor);
    item!.execute(editor);
    const ids = rawHtmlIds(editor.children);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe("");
    expect(ids[0]).not.toBe(ids[1]);
  });
});
