import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";

describe("wikitext-parser — template stripping", () => {
  it("strips unknown templates", () => {
    const html = parseWikitextToHtml("Hello {{unknown|X}} world");
    expect(html).not.toContain("unknown");
    expect(html).toContain("Hello");
    expect(html).toContain("world");
  });

  it("unpacks whitelisted inline templates", () => {
    const html = parseWikitextToHtml("A {{flag|Urcea}} B {{nowrap|text}} N {{formatnum:1234567}}");
    expect(html).toContain("Urcea");
    expect(html).toContain("text");
    expect(html).toContain("1234567");
    expect(html).not.toContain("{{flag");
    expect(html).not.toContain("formatnum:");
  });
});

describe("wikitext-parser — wikitable and image parsing", () => {
  it("correctly parses wikitables with image and link parameters without dangling tokens", () => {
    const wikitext = `{| class="wikitable"
|-
! Region !! Hunting Grounds !! Featured Game !! Notable Estate !! Image
|-
| [[Levantia]] || Stalking ground for fallow deer, red deer, ibex, and driven bird hunting for red legged partridge and wild ducks. || Fallow deer, red deer, Iberian ibex, red-legged partridge || Grand Lodge, Palazzo della chase. || [[File:Palazzo della Caccia - Stupinigi.jpg|120px|center]]
|}`;

    const html = parseWikitextToHtml(wikitext, "ixwiki");
    expect(html).not.toContain("|120px|center]]");
    expect(html).not.toContain("120px|center]]");
    expect(html).toContain("Levantia");
    expect(html).toContain("Palazzo della chase.");
    expect(html).toContain("<table");
    expect(html).toContain("<td");
  });

  it("handles table cells with attributes and nested links cleanly", () => {
    const wikitext = `{| class="wikitable"
|-
| style="text-align: center;" | [[Levantia|Levantian Realm]]
| [[File:Deer.jpg|thumb|A wild [[Red deer]] in the hills]]
|}`;

    const html = parseWikitextToHtml(wikitext, "ixwiki");
    expect(html).toContain("Levantian Realm");
    expect(html).toContain('style="text-align: center;"');
    expect(html).not.toContain("|thumb|");
    expect(html).not.toContain("thumb]]");
  });

  it("never outputs flamingo emoji", () => {
    const html = parseWikitextToHtml("Text with {{SomeUnknownTemplate|foo=bar}} and more text.");
    expect(html).not.toContain("🦩");
  });

  it("parses footnotes (<ref>) and expands them in <references /> with backlink anchors", () => {
    const wikitext = `Urcea is an empire in Levantia.<ref name="urcea-gazette">Royal Gazette of Urcea, Vol. 14.</ref> Its capital is Urceopolis.<ref>Imperial Almanac 2024.</ref>

== References ==
<references />`;

    const html = parseWikitextToHtml(wikitext, "ixwiki");
    expect(html).toContain('id="cite_ref-1"');
    expect(html).toContain('href="#cite_note-1"');
    expect(html).toContain("[1]");
    expect(html).toContain('id="cite_ref-2"');
    expect(html).toContain('href="#cite_note-2"');
    expect(html).toContain("[2]");
    expect(html).toContain('class="references');
    expect(html).toContain('id="cite_note-1"');
    expect(html).toContain("Royal Gazette of Urcea");
    expect(html).toContain("Imperial Almanac 2024");
  });
});


