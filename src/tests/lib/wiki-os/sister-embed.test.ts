/**
 * `sisterEmbedRequestOf` (sister-embed.ts): what the WikiOS reader asks the server for, read from a `Template:Sister`
 * box's four data attributes. Only a wiki WikiOS reads and a title MediaWiki could hold make a request; an unknown
 * mode, or a section mode with no usable section, reads as the whole page. The template writes the title and the
 * section percent-encoded (`{{urlencode:…|PATH}}`, so a quote cannot end the attribute); they are decoded here, and a
 * malformed escape is no request. Nothing from the attributes is spliced into HTML: the request is plain data.
 */
import { describe, expect, it } from "@jest/globals";
import {
  embedPart,
  isSisterEmbedTitle,
  MAX_SISTER_EMBEDS,
  sisterEmbedRequestOf,
  SISTER_EMBED_MODES,
  SISTER_EMBED_SELECTOR,
} from "~/lib/wiki-os/sister-embed";

type Attributes = Partial<Record<"wiki" | "title" | "mode" | "section", string>>;

function box(attributes: Attributes): Element {
  const element = document.createElement("div");
  element.className = "sister-link";
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(`data-sister-${name}`, value);
  }
  return element;
}

describe("sisterEmbedRequestOf", () => {
  it.each([
    [
      { wiki: "iiwiki", title: "Caphiria", mode: "page", section: "" },
      { wiki: "iiwiki", title: "Caphiria", mode: "page", section: null },
    ],
    [
      { wiki: "iiwiki", title: "Caphiria", mode: "section", section: "History" },
      { wiki: "iiwiki", title: "Caphiria", mode: "section", section: "History" },
    ],
    [
      { wiki: "althistory", title: "Main Page", mode: "infobox", section: "" },
      { wiki: "althistory", title: "Main Page", mode: "infobox", section: null },
    ],
    [
      { wiki: "iiwiki", title: "Caphiria", mode: "card", section: "History" },
      { wiki: "iiwiki", title: "Caphiria", mode: "card", section: null },
    ],
  ])("reads a valid box (%j)", (attributes, request) => {
    expect(sisterEmbedRequestOf(box(attributes))).toEqual(request);
  });

  it("reads the wiki in any case and trims what the template passed through", () => {
    expect(
      sisterEmbedRequestOf(box({ wiki: " IIWiki ", title: " Caphiria ", mode: "page" }))
    ).toEqual({ wiki: "iiwiki", title: "Caphiria", mode: "page", section: null });
  });

  it("an unknown wiki, ixwiki, a bracketed title or an over-long section give null or page", () => {
    expect(sisterEmbedRequestOf(box({ wiki: "wikipedia", title: "Rome" }))).toBeNull();
    expect(sisterEmbedRequestOf(box({ wiki: "ixwiki", title: "Caphiria" }))).toBeNull();
    expect(sisterEmbedRequestOf(box({ wiki: "commons", title: "Caphiria" }))).toBeNull();
    expect(sisterEmbedRequestOf(box({ title: "Caphiria" }))).toBeNull();
    expect(sisterEmbedRequestOf(box({ wiki: "iiwiki", title: "[[Caphiria]]" }))).toBeNull();
    expect(sisterEmbedRequestOf(box({ wiki: "iiwiki" }))).toBeNull();
    expect(
      sisterEmbedRequestOf(
        box({ wiki: "iiwiki", title: "Caphiria", mode: "section", section: "x".repeat(256) })
      )
    ).toEqual({ wiki: "iiwiki", title: "Caphiria", mode: "page", section: null });
    expect(
      sisterEmbedRequestOf(
        box({ wiki: "iiwiki", title: "Caphiria", mode: "section", section: "  " })
      )
    ).toEqual({ wiki: "iiwiki", title: "Caphiria", mode: "page", section: null });
    expect(
      sisterEmbedRequestOf(box({ wiki: "iiwiki", title: "Caphiria", mode: "gallery" }))
    ).toEqual({
      wiki: "iiwiki",
      title: "Caphiria",
      mode: "page",
      section: null,
    });
  });

  it("decodes the title and the section the template percent-encoded", () => {
    expect(
      sisterEmbedRequestOf(
        box({
          wiki: "iiwiki",
          title: "The%20%22Red%22%20Army%20%26%20Navy%27s%20100%25",
          mode: "section",
          section: "War%20of%20%2722%20%22Bread%22",
        })
      )
    ).toEqual({
      wiki: "iiwiki",
      title: `The "Red" Army & Navy's 100%`,
      mode: "section",
      section: `War of '22 "Bread"`,
    });
  });

  it("a malformed escape in the title or the section is no request; an escaped forbidden character is refused", () => {
    expect(sisterEmbedRequestOf(box({ wiki: "iiwiki", title: "100%" }))).toBeNull();
    expect(sisterEmbedRequestOf(box({ wiki: "iiwiki", title: "A%E0%A4%A" }))).toBeNull();
    expect(
      sisterEmbedRequestOf(
        box({ wiki: "iiwiki", title: "Caphiria", mode: "section", section: "50%" })
      )
    ).toBeNull();
    expect(sisterEmbedRequestOf(box({ wiki: "iiwiki", title: "A%7CB" }))).toBeNull();
    expect(sisterEmbedRequestOf(box({ wiki: "iiwiki", title: "%5B%5BA%5D%5D" }))).toBeNull();
  });

  it("a section of exactly 255 characters is kept", () => {
    const section = "s".repeat(255);
    expect(
      sisterEmbedRequestOf(box({ wiki: "iiwiki", title: "Caphiria", mode: "section", section }))
    ).toEqual({ wiki: "iiwiki", title: "Caphiria", mode: "section", section });
  });

  it("is found by the selector, and the reader caps live embeds at ten per page", () => {
    const holder = document.createElement("div");
    holder.append(box({ wiki: "iiwiki", title: "Caphiria" }));
    expect(holder.querySelectorAll(SISTER_EMBED_SELECTOR)).toHaveLength(1);
    expect(MAX_SISTER_EMBEDS).toBe(10);
    expect(SISTER_EMBED_MODES).toEqual(["page", "section", "infobox", "card"]);
  });
});

describe("isSisterEmbedTitle", () => {
  it.each(["Caphiria", "Main Page", "Kingdom of Urcea (1850–1900)", "a", "t".repeat(255)])(
    "accepts %s",
    (title) => {
      expect(isSisterEmbedTitle(title)).toBe(true);
    }
  );

  it.each(["", "t".repeat(256), "A#B", "A<B", "A>B", "A[B", "A]B", "A{B", "A}B", "A|B"])(
    "refuses %s",
    (title) => {
      expect(isSisterEmbedTitle(title)).toBe(false);
    }
  );
});

describe("embedPart", () => {
  it("keeps a section only in section mode, and a section mode only with a section", () => {
    expect(embedPart("section", "History")).toEqual({ mode: "section", section: "History" });
    expect(embedPart("section", null)).toEqual({ mode: "page", section: null });
    expect(embedPart("infobox", "History")).toEqual({ mode: "infobox", section: null });
    expect(embedPart("page", null)).toEqual({ mode: "page", section: null });
  });
});
