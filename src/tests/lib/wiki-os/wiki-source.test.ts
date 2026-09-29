/** @jest-environment node */
import { articleHtmlInput, parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";

describe("parseWikiSource", () => {
  it.each(["ixwiki", "iiwiki", "althistory"] as const)("keeps %s", (source) => {
    expect(parseWikiSource(source)).toBe(source);
  });

  it.each([null, undefined, "", "eurth", "IIWIKI", "toString", "__proto__", "constructor"])(
    "reads %p as ixwiki",
    (value) => {
      expect(parseWikiSource(value)).toBe("ixwiki");
    }
  );
});

describe("wikiReaderPath", () => {
  it("opens an ixwiki page without a source parameter", () => {
    expect(wikiReaderPath("United Kingdom of Aurelia")).toBe("/wiki/United_Kingdom_of_Aurelia");
    expect(wikiReaderPath("Aurelia", "ixwiki")).toBe("/wiki/Aurelia");
  });

  it("carries an external wiki as ?source=", () => {
    expect(wikiReaderPath("Portal:Eurth", "iiwiki")).toBe("/wiki/Portal%3AEurth?source=iiwiki");
    expect(wikiReaderPath("Gallambria", "althistory")).toBe("/wiki/Gallambria?source=althistory");
  });

  it("encodes titles so they survive the reader's decodeURIComponent", () => {
    const path = wikiReaderPath("Côte d'Or & Sons?", "iiwiki");
    const slug = path.slice("/wiki/".length, path.indexOf("?source="));
    expect(decodeURIComponent(slug).replace(/_/g, " ")).toBe("Côte d'Or & Sons?");
  });
});

describe("articleHtmlInput", () => {
  it("asks for an IxWiki page by title alone, the key hover prefetch warms", () => {
    expect(articleHtmlInput("Aurelia", "ixwiki")).toEqual({ title: "Aurelia" });
  });

  it("names another wiki", () => {
    expect(articleHtmlInput("Portal:Eurth", "iiwiki")).toEqual({
      title: "Portal:Eurth",
      wikiSource: "iiwiki",
    });
  });
});
