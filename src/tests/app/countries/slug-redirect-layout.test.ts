/** @jest-environment node */
/**
 * `/countries/<old slug>/…?…` (and the maps host's root `/<old slug>`, rewritten here) redirects
 * permanently to the same page and query under a renamed country's current slug; live and
 * unknown slugs render as before. The proxy hands the layout the requested path.
 */
import { NextRequest, type NextFetchEvent } from "next/server";

const mockPermanentRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
jest.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));
const mockRequestHeaders = { current: new Headers() };
jest.mock("next/headers", () => ({ headers: async () => mockRequestHeaders.current }));
const mockFind = jest.fn();
jest.mock("~/server/shared/country-rename", () => ({
  findCountrySlugRedirect: (...args: unknown[]) => mockFind(...args),
}));
jest.mock("~/server/db", () => ({ db: { marker: "db" } }));

import CountrySlugLayout from "~/app/countries/[slug]/layout";
import { countrySlugRedirectPath, REQUEST_PATH_HEADER } from "~/lib/countries/slug-redirect";

const render = (slug: string, requestPath?: string) => {
  mockRequestHeaders.current = new Headers(
    requestPath ? { [REQUEST_PATH_HEADER]: requestPath } : {}
  );
  return CountrySlugLayout({ children: "page", params: Promise.resolve({ slug }) });
};

beforeEach(() => {
  mockFind.mockReset();
  mockPermanentRedirect.mockClear();
});

describe("country slug redirects", () => {
  it("keeps the page below the slug and the query", async () => {
    mockFind.mockResolvedValue("new-testland");
    await expect(render("testland", "/countries/testland/factbook/economy?x=1")).rejects.toThrow(
      "NEXT_REDIRECT /countries/new-testland/factbook/economy?x=1"
    );
    expect(mockFind).toHaveBeenCalledWith({ marker: "db" }, "testland");
  });

  it("redirects the country's own page", async () => {
    mockFind.mockResolvedValue("new-testland");
    await expect(render("testland", "/countries/testland")).rejects.toThrow(
      "NEXT_REDIRECT /countries/new-testland"
    );
  });

  it("redirects the maps host's root address to the country page", async () => {
    mockFind.mockResolvedValue("new-testland");
    await expect(render("testland", "/testland?embed=true")).rejects.toThrow(
      "NEXT_REDIRECT /countries/new-testland?embed=true"
    );
  });

  it("renders a live or unknown slug", async () => {
    mockFind.mockResolvedValue(null);
    await expect(render("testland", "/countries/testland")).resolves.toBe("page");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("renders the page when the lookup fails", async () => {
    mockFind.mockRejectedValue(new Error("relation does not exist"));
    await expect(render("testland")).resolves.toBe("page");
  });
});

describe("countrySlugRedirectPath", () => {
  it.each([
    ["/countries/old/factbook/economy?x=1", "/countries/new/factbook/economy?x=1"],
    ["/countries/Old/dossier", "/countries/new/dossier"],
    ["/countries/old", "/countries/new"],
    [null, "/countries/new"],
    ["/elsewhere/page", "/countries/new"],
  ])("%s → %s", (requestPath, target) => {
    expect(countrySlugRedirectPath(requestPath, "old", "new")).toBe(target);
  });
});

describe("the proxy hands layouts the requested path", () => {
  it("forwards the path and query, overwriting one the client sends", async () => {
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const middleware = (await import("~/proxy")).default as unknown as (
      req: NextRequest,
      event: NextFetchEvent
    ) => Promise<Response>;
    const res = await middleware(
      new NextRequest("http://localhost/countries/old/factbook?tab=1", {
        headers: { [REQUEST_PATH_HEADER]: "/forged" },
      }),
      {} as NextFetchEvent
    );
    expect(res.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)).toBe(
      "/countries/old/factbook?tab=1"
    );
  });
});
