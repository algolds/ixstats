/**
 * The lore writer's word count: the words the author wrote, not the markup around them. A fresh piece (infobox,
 * headings, references and categories only) counts nothing.
 */
import { loreWordCount } from "~/lib/lore/word-count";

describe("loreWordCount", () => {
  it("counts nothing for a fresh piece: infobox, headings, references and category lines", () => {
    const fresh = [
      "{{Infobox settlement",
      "| name = Venceia",
      "| coordinates = {{coord|41.9|12.5}}",
      "}}",
      "",
      "== History ==",
      "",
      "=== Early days ===",
      "",
      "== References ==",
      "<references />",
      "",
      "[[Category:Caphiria lore]]",
      "[[Category:Caphiria]]",
    ].join("\n");
    expect(loreWordCount(fresh)).toBe(0);
  });

  it("counts the prose words", () => {
    expect(loreWordCount("Venceia is the capital of Caphiria.")).toBe(6);
  });

  it("counts a piped link by its label and a plain link by its title", () => {
    expect(loreWordCount("Born in [[Venceia City|the capital]] near [[Latium]].")).toBe(6);
  });

  it("counts an external link by its label only", () => {
    expect(loreWordCount("See [https://example.org the archive] today.")).toBe(4);
  });

  it("leaves out references, comments, files and tags, and keeps bold and italic words", () => {
    const text =
      "'''Venceia''' is ''old''.<ref>Annals, p. 4</ref> <!-- check > this --> [[File:Map.png|thumb|A map]] <br />End";
    expect(loreWordCount(text)).toBe(4);
  });

  it("leaves out a named reference that closes itself, without swallowing the text after it", () => {
    expect(loreWordCount('One<ref name="a" /> two<ref>Annals</ref> three')).toBe(3);
  });

  it("does not count punctuation or table markup as words", () => {
    expect(loreWordCount("{|\n| Venceia || 1012\n|}\n— , .")).toBe(2);
  });

  it("counts nothing for empty text", () => {
    expect(loreWordCount("")).toBe(0);
  });
});
