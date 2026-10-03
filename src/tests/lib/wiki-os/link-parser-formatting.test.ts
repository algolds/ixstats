import { parseInlineLinksAndFormatting } from "~/lib/wiki-os/wikitext/link-parser";

const texts = (wikitext: string) =>
  parseInlineLinksAndFormatting(wikitext).flatMap((n) =>
    "text" in n && n.text
      ? [`${n.text}${"bold" in n && n.bold ? "[b]" : ""}${"italic" in n && n.italic ? "[i]" : ""}`]
      : ["<node>"]
  );

describe("parseInlineLinksAndFormatting bold/italic", () => {
  it("formats plain bold and italic", () => {
    expect(texts("a '''b''' c ''d''")).toEqual(["a ", "b[b]", " c ", "d[i]"]);
  });

  it("keeps bold open across an inline link", () => {
    expect(texts("'''bold [[x]] more''' end")).toEqual(["bold [b]", "<node>", " more[b]", " end"]);
  });

  it("keeps italic open across a template or citation", () => {
    expect(texts("''it {{foo}} still'' out")).toEqual(["it [i]", "<node>", " still[i]", " out"]);
  });
});
