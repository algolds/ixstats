/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import { sanitizeSvg } from "~/lib/media/svg-sanitize";

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

  it("returns null when no svg root remains", () => {
    expect(sanitizeSvg("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeSvg("not an svg")).toBeNull();
  });
});
