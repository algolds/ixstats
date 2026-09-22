import { parseTemplateWikitext } from "~/lib/wiki-os/editor/parse-template-wikitext";

describe("parseTemplateWikitext", () => {
  it("parses a basic template invocation", () => {
    expect(parseTemplateWikitext("{{Infobox country|capital=Vilena}}")).toEqual({
      name: "Infobox country",
      params: { capital: "Vilena" },
    });
  });

  it("parses multiple params", () => {
    expect(
      parseTemplateWikitext("{{CountryData|id=burgundie|metric=gdp|format=currency}}")
    ).toEqual({
      name: "CountryData",
      params: { id: "burgundie", metric: "gdp", format: "currency" },
    });
  });

  it("falls back to defaultName for empty wikitext", () => {
    expect(parseTemplateWikitext("{{}}", "Infobox")).toEqual({
      name: "Infobox",
      params: {},
    });
  });

  it("handles square bracket format without params", () => {
    expect(parseTemplateWikitext("[[Coords:40.7,-74.0|Location]]", "Template", "square")).toEqual({
      name: "Coords:40.7,-74.0",
      params: {},
    });
  });

  it("parses plain strings without brackets as-is", () => {
    expect(parseTemplateWikitext("CountryData|id=test")).toEqual({
      name: "CountryData",
      params: { id: "test" },
    });
  });

  it("preserves pipes inside values (splits on first = only)", () => {
    expect(parseTemplateWikitext("{{Infobox|motto=Liberté, Ordre, Concorde}}")).toEqual({
      name: "Infobox",
      params: { motto: "Liberté, Ordre, Concorde" },
    });
  });

  it("handles nested links with pipes inside parameters without corruption", () => {
    expect(
      parseTemplateWikitext("{{Infobox country|capital=[[Vilena|Vilena City]]|leader=John}}")
    ).toEqual({
      name: "Infobox country",
      params: {
        capital: "[[Vilena|Vilena City]]",
        leader: "John",
      },
    });
  });

  it("handles nested templates with pipes inside parameters without corruption", () => {
    expect(
      parseTemplateWikitext("{{Infobox country|name=Urcea|flag={{flag|Urcea|civil}}|motto=Truth}}")
    ).toEqual({
      name: "Infobox country",
      params: {
        name: "Urcea",
        flag: "{{flag|Urcea|civil}}",
        motto: "Truth",
      },
    });
  });
});

