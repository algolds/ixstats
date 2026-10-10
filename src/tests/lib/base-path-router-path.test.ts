/** @jest-environment node */
// Next's <Link> and router add the base path themselves, so they take a path without it.
import { navigateWithBasePath, toRouterPath } from "~/lib/base-path";
import { navigateTo } from "~/lib/utils/url-utils";

const BASE = "/projects/ixstates";

describe("toRouterPath", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("takes the base path off once", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;

    expect(toRouterPath(`${BASE}/wiki/X?action=edit#a`)).toBe("/wiki/X?action=edit#a");
    expect(toRouterPath(`${BASE}${BASE}/wiki/X`)).toBe(`${BASE}/wiki/X`);
    expect(toRouterPath("/wiki/X")).toBe("/wiki/X");
  });

  it("maps the bare base path to the root", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;

    expect(toRouterPath(BASE)).toBe("/");
    expect(toRouterPath(`${BASE}?tab=x`)).toBe("/?tab=x");
    expect(toRouterPath(`${BASE}#top`)).toBe("/#top");
  });

  it("leaves absolute URLs and lookalike prefixes alone", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;

    expect(toRouterPath("https://ixwiki.com/projects/ixstates/wiki/X")).toBe(
      "https://ixwiki.com/projects/ixstates/wiki/X"
    );
    expect(toRouterPath("//example.org/x")).toBe("//example.org/x");
    expect(toRouterPath(`${BASE}x/y`)).toBe(`${BASE}x/y`);
  });

  it("changes nothing where the deployment has no base path", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.BASE_PATH;

    expect(toRouterPath("/wiki/X")).toBe("/wiki/X");
    expect(toRouterPath("/")).toBe("/");
    expect(toRouterPath("/projects/ixstates/wiki/X")).toBe("/projects/ixstates/wiki/X");
  });
});

describe("router helpers hand the router a path without the base path", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("navigateWithBasePath pushes the plain path for a plain or a prefixed one", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;
    const router = { push: jest.fn() };

    navigateWithBasePath("/mycountry", router);
    navigateWithBasePath(`${BASE}/vault`, router);

    expect(router.push.mock.calls).toEqual([["/mycountry"], ["/vault"]]);
  });

  it("navigateWithBasePath sends an absolute URL to window.location", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;
    const location = { href: "" };
    (globalThis as { window?: unknown }).window = { location };
    const router = { push: jest.fn() };

    navigateWithBasePath("https://example.org/x", router);

    expect(location.href).toBe("https://example.org/x");
    expect(router.push).not.toHaveBeenCalled();
    delete (globalThis as { window?: unknown }).window;
  });

  it("navigateTo pushes the plain path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;
    const router = { push: jest.fn() };

    navigateTo(router, "/setup");
    navigateTo(router, `${BASE}/builder`);

    expect(router.push.mock.calls).toEqual([["/setup"], ["/builder"]]);
  });
});
