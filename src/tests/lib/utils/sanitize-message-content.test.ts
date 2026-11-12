/** @jest-environment node */
/**
 * sanitizeMessageContent: private messages. An <img> is a tracking pixel unless it points at this site (a relative
 * path, the app's own origin, or ixwiki.com); sanitizeUserContent keeps its images as before.
 */
import { describe, expect, it } from "@jest/globals";
import { JSDOM } from "jsdom";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";
import { sanitizeMessageContent } from "~/lib/utils/sanitize-message";

const imageSources = (html: string): string[] =>
  Array.from(JSDOM.fragment(html).querySelectorAll("img")).map(
    (img) => img.getAttribute("src") ?? ""
  );

describe("sanitizeMessageContent", () => {
  it("removes an img on another host", () => {
    const out = sanitizeMessageContent('<p>hi</p><img src="https://tracker.example/pixel.gif">');
    expect(out).toContain("<p>hi</p>");
    expect(imageSources(out)).toEqual([]);
    expect(out).not.toContain("tracker.example");
  });

  it("removes protocol-relative and scheme-less external images", () => {
    expect(imageSources(sanitizeMessageContent('<img src="//tracker.example/p.gif">'))).toEqual([]);
    expect(imageSources(sanitizeMessageContent('<img src="pixel.gif">'))).toEqual([]);
    expect(imageSources(sanitizeMessageContent('<img src="/\\tracker.example/p.gif">'))).toEqual(
      []
    );
  });

  it("keeps a relative path image", () => {
    expect(imageSources(sanitizeMessageContent('<img src="/images/flag.png" alt="flag">'))).toEqual(
      ["/images/flag.png"]
    );
  });

  it("keeps an image on ixwiki.com", () => {
    expect(imageSources(sanitizeMessageContent('<img src="https://ixwiki.com/a.png">'))).toEqual([
      "https://ixwiki.com/a.png",
    ]);
  });

  it("keeps the other allowed markup", () => {
    const out = sanitizeMessageContent(
      '<p><mark>hit</mark> <a href="https://example.com">x</a></p>'
    );
    expect(out).toContain("<mark>hit</mark>");
    expect(out).toContain('href="https://example.com"');
  });
});

describe("sanitizeUserContent", () => {
  it("keeps <mark> for search highlights", () => {
    expect(sanitizeUserContent("<p>a <mark>b</mark></p>")).toContain("<mark>b</mark>");
  });

  it("still keeps an external image (other surfaces rely on it)", () => {
    expect(imageSources(sanitizeUserContent('<img src="https://example.com/a.png">'))).toEqual([
      "https://example.com/a.png",
    ]);
  });
});
