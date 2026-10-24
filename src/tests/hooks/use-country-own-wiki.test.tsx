/**
 * A nation of another wiki (an Eurth nation on IIWiki) reads its own wiki page everywhere the country is shown: the
 * map's info panel (`useCountryPanelData`) and the country profile's infobox (`useCountryProfileLayer`; its Lore tab
 * is tested in lore-reader.test.tsx). The profile names its sovereign by their passport handle, then their forum name,
 * never an old wiki name.
 */
import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const calls: Array<{ path: string; input: object; options: { enabled?: boolean } | undefined }> =
    [];
  const procedure = (path: string) => ({
    useQuery: (input: object, options?: { enabled?: boolean }) => {
      calls.push({ path, input, options });
      return { data: undefined, isLoading: false, error: null, refetch: jest.fn() };
    },
  });
  const api = new Proxy(
    {},
    {
      get: (_r, router: string) =>
        new Proxy({}, { get: (_p, proc: string) => procedure(`${router}.${proc}`) }),
    }
  );
  return { api, calls };
});

import { useCountryPanelData } from "~/hooks/useCountryPanelData";
import { useCountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import type { CountryWithEconomicData } from "~/types/ixstats";

const trpc = jest.requireMock<{
  calls: Array<{ path: string; input: object; options: { enabled?: boolean } | undefined }>;
}>("~/trpc/react");
const inputsOf = (path: string) => trpc.calls.filter((c) => c.path === path).map((c) => c.input);

beforeEach(() => {
  trpc.calls.length = 0;
});

describe("useCountryPanelData", () => {
  it("asks for the section previews and images of the country itself, so its own wiki is read", () => {
    renderHook(() => useCountryPanelData("c-afr", "Afropa"));

    for (const path of ["countries.getWikiSectionPreviews", "countries.getWikiPageImages"]) {
      expect(inputsOf(path)).toContainEqual({ countryName: "Afropa", countryId: "c-afr" });
    }
  });
});

describe("useCountryProfileLayer", () => {
  it("reads an Eurth nation's infobox from IIWiki, and no article text (the Lore tab reads the article)", () => {
    const country = {
      id: "c-afr",
      name: "Afropa",
      wikiSource: "iiwiki",
      wikiPageTitle: "Afropa",
    } as CountryWithEconomicData;

    renderHook(() =>
      useCountryProfileLayer({ country, flagUrl: null, isOwner: false, currentIxTime: 0 })
    );

    expect(inputsOf("wikiCache.getCountryProfile")).toContainEqual({
      countryName: "Afropa",
      wikiSource: "iiwiki",
    });
    expect(inputsOf("wikios.getWikitext")).toEqual([]);
  });

  it.each([
    [{ handle: "ruler", forumUsername: "ForumRuler" }, "ruler"],
    [{ handle: null, forumUsername: "ForumRuler" }, "ForumRuler"],
    [{ handle: null, forumUsername: null }, null],
  ])("names the sovereign %o as %s", (owner, username) => {
    const country = { id: "c-urc", name: "Urcea", owner } as CountryWithEconomicData & {
      owner: typeof owner;
    };

    const { result } = renderHook(() =>
      useCountryProfileLayer({ country, flagUrl: null, isOwner: false, currentIxTime: 0 })
    );

    expect(result.current?.identity.sovereign?.username).toBe(username);
  });
});
