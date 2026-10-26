/**
 * Full-viewport overlays through sanitized HTML: wikitext excerpts (another wiki's raw HTML passes through the
 * compiler), user content (the app's own Tailwind utilities in `class`) and first-party article styles.
 */
import { describe, expect, it } from "@jest/globals";
import { sanitizeUserContent, sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { sanitizeWikiPreviewHtml } from "~/lib/utils/sanitize-wiki-preview";
import { stripUnclosedTagTail } from "~/lib/wiki-os/transformers/clean-markup-passes";
import { cleanWikiMarkup } from "~/lib/wiki-os/transformers/wikitext-parser";
import { parseWikitextToPreviewHtml } from "~/lib/wiki-os/transformers/wikitext-preview";

const OVERLAY =
  '<style>body>*{display:none}</style><a href="https://evil.example" style="position:fixed;inset:0;z-index:2147483647">x</a>';
const UNCLOSED =
  '<style>body>*{display:none}</style><a href="https://evil.example" style="position:fixed;inset:0;z-index:2147483647" x=';

const dom = (html: string): HTMLElement => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

describe("wikitext excerpts (parseWikitextToPreviewHtml)", () => {
  it.each(["ixwiki", "iiwiki", "althistory"])(
    "drops the <style> and the overlay styling from %s wikitext, keeping the link",
    (wiki) => {
      const out = parseWikitextToPreviewHtml(`Lead text. ${OVERLAY}`, wiki);
      const root = dom(out);
      expect(root.querySelector("style")).toBeNull();
      expect(out).not.toMatch(/display:\s*none|position|inset|z-index/i);
      const link = root.querySelector("a");
      expect(link?.getAttribute("href")).toBe("https://evil.example");
      expect(link?.hasAttribute("style")).toBe(false);
      expect(root.textContent).toContain("Lead text.");
    }
  );

  it("an unterminated trailing tag leaves no style behind (the paragraph's `</p>` closes it: an empty link)", () => {
    const out = parseWikitextToPreviewHtml(`Lead text. ${UNCLOSED}`, "iiwiki");
    const root = dom(out);
    expect(root.querySelector("style, [style]")).toBeNull();
    expect(out).not.toMatch(/position|z-index|display/i);
    expect(root.querySelector("a")?.textContent ?? "").toBe("");
  });

  it("drops a TemplateStyles block too: an excerpt keeps no <style>", () => {
    const out = sanitizeWikiPreviewHtml(
      '<style data-mw-deduplicate="x">.a{color:red}</style><p class="mw-parser-output a">t</p>'
    );
    expect(dom(out).querySelector("style")).toBeNull();
  });

  it("strips the app's positioning utilities from a compiled excerpt's classes", () => {
    const out = sanitizeWikiPreviewHtml(
      '<div class="infobox fixed inset-0 z-50"><p class="text-xs mb-3">t</p></div>'
    );
    expect(out).toBe('<div class="infobox"><p class="text-xs mb-3">t</p></div>');
  });
});

describe("cleanWikiMarkup and an unterminated tag", () => {
  it("drops a tag a cut left without its `>`", () => {
    expect(cleanWikiMarkup(`Lead text. ${UNCLOSED}`)).toBe("Lead text. body>*{display:none}");
    expect(cleanWikiMarkup(`Lead text. ${UNCLOSED}`)).not.toContain("<");
  });

  it("keeps a `<` that opens no tag", () => {
    expect(cleanWikiMarkup("a < b and 3 <4")).toBe("a < b and 3 <4");
    expect(stripUnclosedTagTail("a < b")).toBe("a < b");
    expect(stripUnclosedTagTail("x <b>y</b> <a href=")).toBe("x <b>y</b> ");
    expect(stripUnclosedTagTail("x </di")).toBe("x ");
    expect(stripUnclosedTagTail("x <!-- y")).toBe("x ");
  });
});

describe("sanitizeUserContent and the app's utility classes", () => {
  it("strips positioning and stacking classes from a link", () => {
    const out = sanitizeUserContent(
      '<p><a href="https://evil.example" class="fixed inset-0 z-backdrop bg-scrim">.</a></p>'
    );
    const link = dom(out).querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://evil.example");
    const classes = (link?.getAttribute("class") ?? "").split(/\s+/);
    expect(classes).not.toEqual(expect.arrayContaining(["fixed"]));
    expect(classes.some((c) => /^(?:fixed|absolute|sticky|inset-|z-)/.test(c))).toBe(false);
  });

  it.each([
    "absolute top-0 left-0",
    "sticky top-0",
    "md:fixed -inset-x-4",
    "translate-x-1/2 transform",
    "!fixed z-[9999]",
  ])("strips %s", (classes) => {
    const out = sanitizeUserContent(`<div class="${classes}">x</div>`);
    expect(out).toBe("<div>x</div>");
  });

  it("keeps the formatting classes the editors emit", () => {
    const html =
      '<p class="text-blue-500 font-semibold"><span class="mention">@a</span> <a class="hashtag underline" href="/thinkpages?tag=x">#x</a></p>';
    expect(sanitizeUserContent(html)).toBe(html);
  });
});

describe("first-party article styles (sanitizeWikiArticleHtml)", () => {
  it("drops a fixed or sticky position from a style attribute, keeping the rest", () => {
    const out = sanitizeWikiArticleHtml(
      '<div style="position:fixed;inset:0;z-index:99999;background:#fff">Please sign in</div><table style="position: sticky; top: 0; width: 100%"><tbody><tr><td>x</td></tr></tbody></table>'
    );
    expect(out).not.toMatch(/fixed|sticky/);
    expect(out).toContain("background:#fff");
    expect(out).toContain("width: 100%");
  });

  it("drops a fixed position spelled with a CSS escape", () => {
    const out = sanitizeWikiArticleHtml('<div style="position:\\66ixed;color:red">x</div>');
    expect(out).not.toMatch(/position/);
  });

  it("leaves infobox and location-map styles as written", () => {
    const html =
      '<table class="infobox" style="width:22em;background:#f8f9fa;float:right"><tbody><tr><td><div style="position:relative;width:250px"><div style="position:absolute;top:40%;left:30%">•</div></div></td></tr></tbody></table>';
    expect(sanitizeWikiArticleHtml(html)).toBe(html);
  });

  it("drops a fixed position from a TemplateStyles block", () => {
    const out = sanitizeWikiArticleHtml(
      '<style data-mw-deduplicate="TemplateStyles:r1">.banner{position:fixed;inset:0;color:red}</style><div class="banner">x</div>'
    );
    expect(out).toContain("color:red");
    expect(out).not.toContain("fixed");
  });
});
