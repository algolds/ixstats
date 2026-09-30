/** @jest-environment node */
/**
 * Plan 404 review: template chips are stored as inert markers, written with the DOM at render time
 * and substituted, exactly, at serve time.
 */
import {
  chipKeysIn,
  chipMarker,
  isMarkableKey,
  markTemplateChips,
  substituteChipMarkers,
  templateKeysOf,
} from "~/lib/wiki-os/templates/chip-markers";

describe("isMarkableKey", () => {
  it.each([
    "MyCountry:gdp",
    "CountryData:Aurelia:population",
    "BusinessData:Acme Corp (Eurth):revenue",
  ])("accepts %p", (key) => expect(isMarkableKey(key)).toBe(true));

  it.each([
    ["an unknown prefix", "Other:gdp"],
    ["a bare prefix", "MyCountry"],
    ["a quote", 'MyCountry:a"b'],
    ["an ampersand", "CountryData:Bosnia & Herzegovina:population"],
    ["an angle bracket", "CountryData:A<B:population"],
    ["an equals sign", "MyCountry:a=b"],
    ["a line break", "MyCountry:a\nb"],
    ["an empty segment", "CountryData::population"],
  ])("refuses %s", (_name, key) => expect(isMarkableKey(key)).toBe(false));

  it("refuses a key longer than a title can be", () => {
    expect(isMarkableKey(`MyCountry:${"a".repeat(300)}`)).toBe(false);
  });
});

describe("markTemplateChips", () => {
  it("returns HTML with no chip in it byte for byte, without a DOM round trip", () => {
    const html = '<p class="x">Plain &amp; <a href="/wiki/Foo">simple</a><br></p><p>unclosed';
    expect(markTemplateChips(html)).toBe(html);
  });

  it("replaces a chip link, whatever it wraps, and a raw chip", () => {
    const out = markTemplateChips(
      '<p><a href="/wiki/Template:CountryData:Aurelia:population"><b>12</b></a> and {{MyCountry:gdp}}.</p>'
    );

    expect(out).toBe(
      `<p>${chipMarker("CountryData:Aurelia:population")} and ${chipMarker("MyCountry:gdp")}.</p>`
    );
  });

  it("decodes a percent-encoded link target", () => {
    expect(markTemplateChips('<a href="/wiki/Template%3AMyCountry%3Agdp">x</a>')).toBe(
      chipMarker("MyCountry:gdp")
    );
  });

  it("drops a link's whole label, even when it carries markup that looks like the end of the link", () => {
    const out = markTemplateChips(
      '<a href="/wiki/Template:MyCountry:x"><span title="</a><img src=x onerror=alert(1)>">y</span></a>'
    );

    expect(out).toBe(chipMarker("MyCountry:x"));
  });

  it("leaves ordinary links, other templates and chips outside the alphabet alone", () => {
    const html =
      '<a href="/wiki/Foo">a</a><a href="/wiki/Template:Other:x">b</a><a href="/wiki/Template:CountryData:A%3CB:pop">c</a>';

    expect(markTemplateChips(html)).toBe(html);
    expect(markTemplateChips(html)).not.toContain("data-wikios-chip");
  });

  it("does not look inside script and style", () => {
    const out = markTemplateChips("<style>/* {{MyCountry:x}} */</style><p>{{MyCountry:y}}</p>");

    expect(out).toContain("/* {{MyCountry:x}} */");
    expect(out).toContain(chipMarker("MyCountry:y"));
  });
});

describe("substituteChipMarkers and chipKeysIn", () => {
  const html = `<p>${chipMarker("MyCountry:a")} ${chipMarker("MyCountry:b")} ${chipMarker("MyCountry:a")}</p>`;

  it("finds each key once, across several parts", () => {
    expect(chipKeysIn(html, null, chipMarker("CountryData:X:y"))).toEqual([
      "MyCountry:a",
      "MyCountry:b",
      "CountryData:X:y",
    ]);
  });

  it("replaces every exact marker, through a function, without reading `$` in what it returns", () => {
    const out = substituteChipMarkers(html, (key) => `[$&${key}]`);

    expect(out).toBe("<p>[$&MyCountry:a] [$&MyCountry:b] [$&MyCountry:a]</p>");
  });

  it.each([
    ["an extra attribute", '<span class="c" data-wikios-chip="MyCountry:a"></span>'],
    ["a child", '<span data-wikios-chip="MyCountry:a">x</span>'],
    ["another tag", '<b data-wikios-chip="MyCountry:a"></b>'],
    ["single quotes", "<span data-wikios-chip='MyCountry:a'></span>"],
    ["escaped text", '&lt;span data-wikios-chip="MyCountry:a"&gt;&lt;/span&gt;'],
    [
      "an attribute value",
      '<p title="<span data-wikios-chip=&quot;MyCountry:a&quot;></span>">x</p>',
    ],
    ["a key outside the alphabet", '<span data-wikios-chip="MyCountry:a&amp;b"></span>'],
  ])("does not match %s", (_name, lookalike) => {
    expect(chipKeysIn(lookalike)).toEqual([]);
    expect(substituteChipMarkers(lookalike, () => "CHIP")).toBe(lookalike);
  });
});

describe("templateKeysOf", () => {
  it("turns chip keys into provider keys", () => {
    expect(templateKeysOf(["MyCountry:gdp", "CountryData:Aurelia:population"])).toEqual([
      { key: "MyCountry:gdp", category: "mycountry", target: "", field: "gdp" },
      {
        key: "CountryData:Aurelia:population",
        category: "countrydata",
        target: "Aurelia",
        field: "population",
      },
    ]);
  });
});
