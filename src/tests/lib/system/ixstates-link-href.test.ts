/** @jest-environment node */
// ixstatesHref is for a plain <a href>: it carries the deployment's base path. Next's <Link> adds the base path
// itself, so a <Link> takes ixstatesLinkHref, which is the same route with the base path taken off once.
import { ixstatesHref, ixstatesLinkHref } from "~/lib/system/wikios-standalone";

const BASE = "/projects/ixstates";
const IXSTATES = `https://ixwiki.com${BASE}`;

describe("ixstatesLinkHref", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  function inIxstates(base: string | null): void {
    delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
    delete process.env.BASE_PATH;
    if (base === null) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = base;
  }

  it("is the path without the base path, because <Link> adds it", () => {
    inIxstates(BASE);

    expect(ixstatesHref("/blurbs")).toBe(`${BASE}/blurbs`);
    expect(ixstatesLinkHref("/blurbs")).toBe("/blurbs");
    expect(ixstatesLinkHref("/countries/aurelia?tab=x#top")).toBe("/countries/aurelia?tab=x#top");
    expect(ixstatesLinkHref("mycountry/diplomacy")).toBe("/mycountry/diplomacy");
  });

  it("strips the base path once: a path that already carries it does not lose a second copy", () => {
    inIxstates(BASE);

    expect(ixstatesLinkHref(`${BASE}/blurbs`)).toBe("/blurbs");
    expect(ixstatesLinkHref(`${BASE}${BASE}/blurbs`)).toBe(`${BASE}/blurbs`);
  });

  it("is / for the root, never the bare base path or an empty string", () => {
    inIxstates(BASE);

    expect(ixstatesHref("/")).toBe(BASE);
    expect(ixstatesLinkHref("/")).toBe("/");
    expect(ixstatesLinkHref(BASE)).toBe("/");
    expect(ixstatesLinkHref(`${BASE}?tab=x`)).toBe("/?tab=x");
    expect(ixstatesLinkHref(`${BASE}#top`)).toBe("/#top");
  });

  it("does not mistake a path that only starts with the base path's letters for one under it", () => {
    inIxstates(BASE);

    expect(ixstatesLinkHref("/ixstatesx/y")).toBe("/ixstatesx/y");
    expect(ixstatesLinkHref("/projects/ixstatesx/y")).toBe("/projects/ixstatesx/y");
  });

  it("is the path itself where the deployment has no base path", () => {
    inIxstates(null);

    expect(ixstatesLinkHref("/blurbs")).toBe("/blurbs");
    expect(ixstatesLinkHref("/")).toBe("/");
    expect(ixstatesLinkHref("mycountry")).toBe("/mycountry");
  });

  it("leaves an absolute URL alone", () => {
    inIxstates(BASE);

    expect(ixstatesLinkHref("https://example.org/x")).toBe("https://example.org/x");
    expect(ixstatesLinkHref("//example.org/x")).toBe("//example.org/x");
    expect(ixstatesLinkHref(`${IXSTATES}/blurbs`)).toBe(`${IXSTATES}/blurbs`);
  });

  it("is the absolute IxStates URL in the standalone WikiOS build, where <Link> adds nothing", () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    process.env.NEXT_PUBLIC_IXSTATES_URL = IXSTATES;
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;

    expect(ixstatesLinkHref("/blurbs")).toBe(`${IXSTATES}/blurbs`);
    expect(ixstatesLinkHref("/")).toBe(`${IXSTATES}/`);
  });
});
