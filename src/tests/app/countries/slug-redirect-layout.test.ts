/** @jest-environment node */
/**
 * `/countries/<old slug>` (and the maps host's root `/<old slug>`, rewritten here) redirects
 * permanently to a renamed country's current slug; live and unknown slugs render as before.
 */
const mockPermanentRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
jest.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));
const mockFind = jest.fn();
jest.mock("~/server/shared/country-rename", () => ({
  findCountrySlugRedirect: (...args: unknown[]) => mockFind(...args),
}));
jest.mock("~/server/db", () => ({ db: { marker: "db" } }));

import CountrySlugLayout from "~/app/countries/[slug]/layout";

const render = (slug: string) =>
  CountrySlugLayout({ children: "page", params: Promise.resolve({ slug }) });

beforeEach(() => {
  mockFind.mockReset();
  mockPermanentRedirect.mockClear();
});

describe("country slug redirects", () => {
  it("redirects an old slug permanently to the current one", async () => {
    mockFind.mockResolvedValue("new-testland");
    await expect(render("testland")).rejects.toThrow("NEXT_REDIRECT /countries/new-testland");
    expect(mockFind).toHaveBeenCalledWith({ marker: "db" }, "testland");
  });

  it("renders a live or unknown slug", async () => {
    mockFind.mockResolvedValue(null);
    await expect(render("testland")).resolves.toBe("page");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("renders the page when the lookup fails", async () => {
    mockFind.mockRejectedValue(new Error("relation does not exist"));
    await expect(render("testland")).resolves.toBe("page");
  });
});
