/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import { JSDOM } from "jsdom";
import { sanitizeSvg } from "~/lib/media/svg-sanitize";

/** Parses `markup` the way a browser reads a stored .svg file; the parse error text, or null when well-formed. */
function xmlError(markup: string): string | null {
  const { DOMParser } = new JSDOM("").window;
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  return doc.getElementsByTagName("parsererror")[0]?.textContent ?? null;
}

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;

describe("sanitizeSvg", () => {
  it("keeps a plain svg", () => {
    const out = sanitizeSvg("<svg><rect/></svg>");
    expect(out).toContain("<svg");
    expect(out).toContain("<rect");
    expect(out).toContain("xmlns=");
  });

  it("removes a script element", () => {
    const out = sanitizeSvg(wrap("<script>alert(1)</script><rect/>"));
    expect(out).not.toMatch(/script|alert/i);
    expect(out).toContain("<rect");
  });

  it("removes event handler attributes", () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onclick="x()"/></svg>');
    expect(out).not.toMatch(/onload|onclick|alert/i);
  });

  it("removes javascript: links", () => {
    const out = sanitizeSvg(wrap('<a href="javascript:alert(1)"><text>x</text></a>'));
    expect(out).not.toMatch(/javascript|href/i);
  });

  it("removes foreignObject", () => {
    const out = sanitizeSvg(wrap("<foreignObject><div>hi</div></foreignObject><rect/>"));
    expect(out).not.toMatch(/foreignObject|<div/i);
  });

  it("removes external use references but keeps fragment ones", () => {
    const out = sanitizeSvg(
      wrap('<defs><g id="a"/></defs><use href="https://evil.example/x.svg#a"/><use href="#a"/>')
    );
    expect(out).not.toContain("evil.example");
    expect(out).toContain('href="#a"');
  });

  it("drops a style that imports another resource", () => {
    const out = sanitizeSvg(wrap("<style>@import url(https://evil.example/a.css);</style><rect/>"));
    expect(out).not.toContain("evil.example");
  });

  it("round-trips a non-breaking space as well-formed XML", () => {
    const out = sanitizeSvg(wrap('<text aria-label="a\u00a0b">a\u00a0b</text>'));
    expect(out).not.toContain("&nbsp;");
    expect(out).toContain("a\u00a0b");
    expect(xmlError(out ?? "")).toBeNull();
  });

  it("removes a style attribute that loads an external url", () => {
    const out = sanitizeSvg(wrap('<rect style="fill:url(https://x.example/a)"/>'));
    expect(out).not.toContain("x.example");
    expect(out).toContain("<rect");
  });

  it.each(["fill", "filter", "mask", "clip-path", "marker-start"])("removes an external url in %s", (attr) => {
    const out = sanitizeSvg(wrap(`<rect ${attr}="url(https://x.example/a)"/>`));
    expect(out).not.toContain("x.example");
  });

  it("keeps a same-document url in a presentation attribute", () => {
    const out = sanitizeSvg(wrap('<defs><linearGradient id="g"/></defs><rect fill="url(#g)"/>'));
    expect(out).toContain('fill="url(#g)"');
  });

  it("removes a CSS escape in a style attribute or element", () => {
    const attr = sanitizeSvg(wrap('<rect style="fill:\\75 rl(https://x.example/a)"/>'));
    expect(attr).not.toContain("x.example");
    const element = sanitizeSvg(wrap("<style>.a{fill:\\75 rl(https://x.example/a)}</style><rect/>"));
    expect(element).not.toContain("x.example");
  });

  it("keeps a style whose url is a quoted same-document reference", () => {
    const out = sanitizeSvg(wrap('<style>.a{fill:url("#g")}</style><rect class="a"/>'));
    expect(out).toContain('url("#g")');
  });

  it("returns null when no svg root remains", () => {
    expect(sanitizeSvg("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeSvg("not an svg")).toBeNull();
  });
});
