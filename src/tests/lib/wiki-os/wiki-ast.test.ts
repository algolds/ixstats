import {
  WikiTextNode,
  WikiDocument,
  WikiParagraphBlock,
  WikiHeadingBlock,
  WikiInfoboxBlock,
  TemplateBlock,
  MediaBlock,
} from "~/lib/wiki-os/core/wiki-ast";
import {
  isTextNode,
  isInlineNode,
  isBlockNode,
  isHeadingBlock,
  isParagraphBlock,
  isInfoboxBlock,
  isTemplateBlock,
  isMediaBlock,
} from "~/lib/wiki-os/core/wiki-ast-guards";

describe("wiki-ast", () => {
  const textNode: WikiTextNode = { text: "Hello", bold: true };

  const heading: WikiHeadingBlock = {
    type: "heading",
    level: 2,
    children: [{ text: "History" }],
  };

  const paragraph: WikiParagraphBlock = {
    type: "paragraph",
    children: [
      textNode,
      { type: "wiki-link", target: "Burgundie", children: [{ text: "Burgundie" }] },
    ],
  };

  const infobox: WikiInfoboxBlock = {
    type: "infobox",
    templateName: "Infobox country",
    variantId: "sovereign",
    params: { capital: "Vilena", motto: "Liberté, Ordre, Concorde" },
    children: [{ text: "" }],
  };

  const template: TemplateBlock = {
    type: "template",
    templateName: "CountryData",
    format: "inline",
    params: { id: "burgundie", metric: "gdp" },
    children: [{ text: "" }],
  };

  const media: MediaBlock = {
    type: "media",
    filename: "File:Example.svg",
    align: "thumb",
    children: [{ text: "" }],
  };

  const doc: WikiDocument = {
    title: "Burgundie",
    slug: "burgundie",
    version: 1,
    nodes: [infobox, heading, paragraph, media, template],
    metadata: { categories: ["Nations"], wordCount: 42 },
  };

  it("constructs a valid WikiDocument with mixed block types", () => {
    expect(doc.nodes).toHaveLength(5);
    expect(doc.metadata?.wordCount).toBe(42);
  });

  it("discriminates infobox blocks by type guard", () => {
    expect(isInfoboxBlock(infobox)).toBe(true);
    expect(isInfoboxBlock(heading)).toBe(false);
    if (isInfoboxBlock(infobox)) {
      expect(infobox.params.capital).toBe("Vilena");
      expect(infobox.variantId).toBe("sovereign");
    }
  });

  it("discriminates heading, paragraph, template, and media blocks", () => {
    expect(isHeadingBlock(heading)).toBe(true);
    expect(isParagraphBlock(paragraph)).toBe(true);
    expect(isTemplateBlock(template)).toBe(true);
    expect(isMediaBlock(media)).toBe(true);
    expect(isHeadingBlock(infobox)).toBe(false);
    expect(isTemplateBlock(media)).toBe(false);
  });

  it("distinguishes text nodes from block and inline entity nodes", () => {
    expect(isTextNode(textNode)).toBe(true);
    expect(isTextNode(paragraph.children[1]!)).toBe(false);
    expect(isBlockNode(textNode)).toBe(false);
    expect(isInlineNode(textNode)).toBe(true);
    expect(isBlockNode(heading)).toBe(true);
  });

  it("keeps void blocks with empty-text children (Plate compatibility)", () => {
    expect(infobox.children).toEqual([{ text: "" }]);
    expect(template.children).toEqual([{ text: "" }]);
  });
});
