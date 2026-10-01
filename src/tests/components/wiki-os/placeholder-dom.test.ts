/**
 * Plan 404 review: injectPlaceholderElements and addSectionEditLinks did regex surgery on
 * already-sanitized HTML. The sanitizer's serializer leaves `<` and `>` unescaped inside attribute
 * values, so `[[Coords:1,2|<span title="</a><img ...>">y</span>]]` made the regex end a link inside
 * an attribute and publish the rest as live markup. They now work on the DOM.
 */
import {
  extractStatKeys,
  injectPlaceholderElements,
} from "~/components/wiki-os/reader/placeholder-dom";
import { appendSectionEditLinks } from "~/lib/wiki-os/transformers/html-transformer";

/** What a browser makes of `html` once it is put in the page. */
function mount(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

function expectInert(container: HTMLElement) {
  expect(container.querySelectorAll("img")).toHaveLength(0);
  expect(container.querySelectorAll("[onerror]")).toHaveLength(0);
  expect(container.querySelectorAll("script")).toHaveLength(0);
}

describe("injectPlaceholderElements", () => {
  it("turns a coordinates link into a placeholder with the label and the numbers", () => {
    const container = mount(
      injectPlaceholderElements('<p>At <a href="/wiki/Coords:12.5,-30.25,6">the capital</a>.</p>')
    );

    const placeholder = container.querySelector(".wikios-coords-placeholder");
    expect(placeholder?.getAttribute("data-lat")).toBe("12.5");
    expect(placeholder?.getAttribute("data-lng")).toBe("-30.25");
    expect(placeholder?.getAttribute("data-zoom")).toBe("6");
    expect(placeholder?.getAttribute("data-label")).toBe("the capital");
    expect(placeholder?.textContent).toBe("the capital");
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("At the capital.");
  });

  it("does not let a label break out of its link (the reviewer's payload)", () => {
    const html = injectPlaceholderElements(
      '<p><a href="/wiki/Coords:1,2"><span title="</a><img src=x onerror=alert(1)>">y</span></a> tail</p>'
    );
    const container = mount(html);

    expectInert(container);
    expect(container.querySelector(".wikios-coords-placeholder")?.textContent).toBe("y");
    expect(container.textContent).toBe("y tail");
  });

  it("does not let a map embed's options or a stat link break out either", () => {
    const payload = '<span title="</a><img src=x onerror=alert(1)>">y</span>';
    const container = mount(
      injectPlaceholderElements(
        `<p><a href="/wiki/MapEmbed:3,4,5">${payload}</a><a href="/wiki/Template:MyCountry:gdp">${payload}</a></p>`
      )
    );

    expectInert(container);
    expect(
      container.querySelector(".wikios-map-embed-placeholder")?.getAttribute("data-options")
    ).toBe("y");
    expect(container.querySelector(".wikios-stat-placeholder")?.getAttribute("data-key")).toBe(
      "MyCountry:gdp"
    );
  });

  it("does not let a quote in a link or a label add an attribute", () => {
    const container = mount(
      injectPlaceholderElements(
        '<a href="/wiki/Coords:1%22%20onmouseover%3D%22alert(1),2">say &quot;hi&quot; " x=y</a>'
      )
    );

    const placeholder = container.querySelector(".wikios-coords-placeholder")!;
    expect(
      Array.from(placeholder.attributes)
        .map((a) => a.name)
        .sort()
    ).toEqual(["class", "data-label", "data-lat", "data-lng", "data-zoom"]);
    expect(placeholder.getAttribute("data-label")).toBe('say "hi" " x=y');
  });

  it("turns stat template links and raw text templates into stat placeholders", () => {
    const container = mount(
      injectPlaceholderElements(
        '<p><a href="/wiki/Template:CountryData:Aurelia:population">x</a> {{MyCountry:gdp}} {{BusinessData:Acme:revenue}} {{Other:x}}</p>'
      )
    );

    expect(
      Array.from(container.querySelectorAll(".wikios-stat-placeholder")).map((el) =>
        el.getAttribute("data-key")
      )
    ).toEqual(["CountryData:Aurelia:population", "MyCountry:gdp", "BusinessData:Acme:revenue"]);
    expect(container.textContent).toContain("{{Other:x}}");
  });

  it("turns raw [[Coords:..]] and [[MapEmbed:..]] text into placeholders", () => {
    const container = mount(
      injectPlaceholderElements(
        "<p>[[Coords:1,2|Home]] and [[MapEmbed:3,4,5|dark]] and [[Coords:9,8]]</p>"
      )
    );

    const coords = Array.from(container.querySelectorAll(".wikios-coords-placeholder"));
    expect(coords.map((el) => el.getAttribute("data-label"))).toEqual(["Home", "Location"]);
    expect(
      container.querySelector(".wikios-map-embed-placeholder")?.getAttribute("data-options")
    ).toBe("dark");
    expect(
      container.querySelector(".wikios-map-embed-placeholder")?.getAttribute("data-zoom")
    ).toBe("5");
  });

  it("leaves ordinary links and other templates alone, and removes iframes", () => {
    const html =
      '<p><a href="/wiki/Foo" class="x">Foo</a> <a href="/wiki/Template:Other:x">T</a></p><iframe src="https://evil.example"></iframe>';
    const out = injectPlaceholderElements(html);

    expect(out).toBe(
      '<p><a href="/wiki/Foo" class="x">Foo</a> <a href="/wiki/Template:Other:x">T</a></p>'
    );
  });

  it("keeps the rest of the HTML as it was", () => {
    const html =
      '<table class="infobox"><tbody><tr><th>Capital</th><td>A &amp; B</td></tr></tbody></table><ul><li>one</li></ul>';

    expect(injectPlaceholderElements(html)).toBe(html);
  });

  it("does not load or run anything while it parses", () => {
    const loads = jest.fn();
    const probe = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      set: loads,
      get: () => "",
    });

    injectPlaceholderElements(
      '<img src="https://tracker.example/x.png" onerror="alert(1)"><a href="/wiki/Coords:1,2">x</a>'
    );

    expect(loads).not.toHaveBeenCalled();
    if (probe) Object.defineProperty(HTMLImageElement.prototype, "src", probe);
  });
});

/**
 * The links added to a parsed fragment, as HTML. The reader adds them to its live article instead
 * (plan 413); the DOM-only way of doing it is what these cases are about.
 */
function addSectionEditLinks(html: string, slug: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  appendSectionEditLinks(template.content, slug);
  return template.innerHTML;
}

describe("parsing stays inert (plan 404 review)", () => {
  it("makes and serializes every node in the template's own document, never in the live page", () => {
    const createElement = jest.spyOn(document, "createElement");
    const createFragment = jest.spyOn(document, "createDocumentFragment");
    const createWalker = jest.spyOn(document, "createTreeWalker");
    const adopt = jest.spyOn(document, "adoptNode");
    const importNode = jest.spyOn(document, "importNode");

    try {
      const out = injectPlaceholderElements(
        '<img src="x" onerror="alert(1)"><a href="/wiki/Coords:1,2">x</a> {{MyCountry:gdp}} [[MapEmbed:1,2,3]]'
      );
      addSectionEditLinks("<h2>Head</h2>", "Foo");
      extractStatKeys("<p>{{MyCountry:gdp}}</p>");

      expect(out).toContain("wikios-coords-placeholder");
      // The only node the live document makes is the <template> that holds the parse.
      expect(createElement.mock.calls.map(([tag]) => tag)).toEqual([
        "template",
        "template",
        "template",
      ]);
      expect(createFragment).not.toHaveBeenCalled();
      expect(createWalker).not.toHaveBeenCalled();
      expect(adopt).not.toHaveBeenCalled();
      expect(importNode).not.toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("keeps an image in the fragment from ever being attached to the live page", () => {
    const before = document.querySelectorAll("img").length;

    injectPlaceholderElements('<img src="https://tracker.example/x.png" onerror="alert(1)">');

    expect(document.querySelectorAll("img")).toHaveLength(before);
  });
});

describe("extractStatKeys", () => {
  it("finds stat placeholders, stat links and raw templates, once each", () => {
    const keys = extractStatKeys(
      '<p><span class="wikios-stat-placeholder" data-key="MyCountry:gdp"></span>' +
        '<a href="/wiki/Template:CountryData:Aurelia:population">x</a>' +
        "{{MyCountry:gdp}} {{BusinessData:Acme:revenue}} {{Other:x}}</p>"
    );

    expect(keys.sort()).toEqual([
      "BusinessData:Acme:revenue",
      "CountryData:Aurelia:population",
      "MyCountry:gdp",
    ]);
  });

  it("finds nothing in ordinary HTML", () => {
    expect(extractStatKeys('<p>Plain <a href="/wiki/Foo">text</a></p>')).toEqual([]);
  });
});

describe("addSectionEditLinks", () => {
  it("does not write the link into an attribute that holds a closing heading tag (the same class of bug)", () => {
    const html =
      '<h2 id="Geo"><span title="</h2><img src=x onerror=alert(1)>">Geography</span></h2><p>Body</p>';
    const container = mount(addSectionEditLinks(html, "Foo"));

    expectInert(container);
    const links = container.querySelectorAll(".wikios-section-edit-link");
    expect(links).toHaveLength(1);
    expect(links[0]?.closest("h2")).not.toBeNull();
    expect(container.querySelector("h2 span")?.getAttribute("title")).toBe(
      "</h2><img src=x onerror=alert(1)>"
    );
  });

  it("puts a heading's text in the link and its label, escaped by the DOM", () => {
    const container = mount(
      addSectionEditLinks('<h3 id="x">Rock &amp; "Roll" &lt;live&gt;</h3>', "Foo_Bar")
    );

    const link = container.querySelector<HTMLAnchorElement>(".wikios-section-edit-link")!;
    expect(link.getAttribute("aria-label")).toBe('Edit section: Rock & "Roll" <live>');
    expect(link.getAttribute("href")).toContain(
      `/wiki/Foo_Bar?action=edit&section=${encodeURIComponent('Rock & "Roll" <live>')}`
    );
    expect(link.textContent).toBe("Edit");
  });
});
