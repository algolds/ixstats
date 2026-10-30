/**
 * /util/random answers on the server: a redirect to a random article (the lookup Special:Random uses),
 * never a client page that renders a spinner and then navigates.
 */
class RouteSignal extends Error {}
const mockRedirect = jest.fn((url: string) => {
  throw new RouteSignal(`redirect:${url}`);
});
const mockNotFound = jest.fn(() => {
  throw new RouteSignal("not-found");
});
jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: () => mockNotFound(),
}));

const mockRandomPage = jest.fn();
jest.mock("~/trpc/server", () => ({
  __esModule: true,
  api: { wikios: { getRandomPage: (...args: unknown[]) => mockRandomPage(...args) } },
}));

import RandomPage, { dynamic } from "~/app/(wiki-os)/util/random/page";

beforeEach(() => jest.clearAllMocks());

describe("/util/random", () => {
  it("redirects to the random article's wiki path", async () => {
    mockRandomPage.mockResolvedValue({ title: "Federal Republic of Aurelia" });

    await expect(RandomPage()).rejects.toThrow("redirect:/wiki/Federal_Republic_of_Aurelia");
    expect(mockRandomPage).toHaveBeenCalledTimes(1);
  });

  it("is a 404 when there is no page to pick", async () => {
    mockRandomPage.mockResolvedValue({ title: null });

    await expect(RandomPage()).rejects.toThrow("not-found");
  });

  it("is rendered on every request, so it is never one prerendered answer", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
