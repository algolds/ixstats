import { parseWikitextToHtml } from "./wikitext-parser";

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
