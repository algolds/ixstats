import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";

describe("wikitext-parser — unknown template preservation", () => {
  it("strips unknown templates by default (display behavior unchanged)", () => {
    const html = parseWikitextToHtml("Hello {{unknown|X}} world");
    expect(html).not.toContain("unknown");
    expect(html).not.toContain("wikios-template-placeholder");
    expect(html).toContain("Hello");
    expect(html).toContain("world");
  });

  it("preserve mode renders a machine-detectable placeholder", () => {
    const html = parseWikitextToHtml("Hello {{unknown|X}} world", "ixwiki", {
      preserveUnknownTemplates: true,
    });
    expect(html).toContain("wikios-template-placeholder");
    const match = html.match(/data-wikios-template="([^"]+)"/);
    expect(match).toBeDefined();
    expect(decodeURIComponent(match![1]!)).toBe("{{unknown|X}}");
  });

  it("whitelist templates unpack identically in both modes", () => {
    const stripped = parseWikitextToHtml("A {{flag|Urcea}} B {{nowrap|text}}");
    const preserved = parseWikitextToHtml("A {{flag|Urcea}} B {{nowrap|text}}", "ixwiki", {
      preserveUnknownTemplates: true,
    });
    expect(stripped).toContain("Urcea");
    expect(preserved).toContain("Urcea");
    expect(stripped).not.toContain("nowrap>");
    // nowrap content survives in both
    expect(stripped).toContain("text");
    expect(preserved).toContain("text");
    // and neither contains the raw flag invocation
    expect(preserved).not.toContain("{{flag");
  });

  it("preserves one placeholder for nested unknown templates", () => {
    const html = parseWikitextToHtml("X {{outer|{{inner}} }} Y", "ixwiki", {
      preserveUnknownTemplates: true,
    });
    const placeholders = html.match(/data-wikios-template=/g) ?? [];
    expect(placeholders.length).toBe(1);
    const match = html.match(/data-wikios-template="([^"]+)"/);
    expect(decodeURIComponent(match![1]!)).toBe("{{outer|{{inner}} }}");
  });

  it("formatnum still unpacks in preserve mode", () => {
    const html = parseWikitextToHtml("N {{formatnum:1234567}}", "ixwiki", {
      preserveUnknownTemplates: true,
    });
    expect(html).toContain("1234567");
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

  it("never outputs flamingo emoji in preserve or default mode", () => {
    const wikitext = "Text with {{SomeUnknownTemplate|foo=bar}} and more text.";
    const defaultHtml = parseWikitextToHtml(wikitext, "ixwiki");
    expect(defaultHtml).not.toContain("\ud83e\udda9");
    expect(defaultHtml).not.toContain("🦩");

    const preservedHtml = parseWikitextToHtml(wikitext, "ixwiki", {
      preserveUnknownTemplates: true,
    });
    expect(preservedHtml).not.toContain("\ud83e\udda9");
    expect(preservedHtml).not.toContain("🦩");
    expect(preservedHtml).toContain("🧩");
    expect(preservedHtml).toContain("SomeUnknownTemplate");
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


